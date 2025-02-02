import {
  BaseSource,
  Candidate,
  Context,
  DdcEvent,
  Denops,
  fn,
  gather,
  imap,
  range,
} from "./deps.ts";

export function splitPages(
  minLines: number,
  maxLines: number,
  size: number,
): Iterable<[number, number]> {
  return imap(
    range(minLines, /* < */ maxLines + 1, size),
    (lnum: number) => [lnum, /* <= */ lnum + size - 1],
  );
}

export function allWords(lines: string[]): string[] {
  return lines.flatMap((line) => [...line.matchAll(/[a-zA-Z0-9_]+/g)])
    .map((match) => match[0]).filter((e, i, self) => self.indexOf(e) === i);
}

type Params = {
  requireSameFiletype: boolean;
  limitBytes: number;
  fromAltBuf: boolean;
};

type bufCache = {
  bufnr: number;
  filetype: string;
  candidates: Candidate[];
};

export class Source extends BaseSource {
  private buffers: bufCache[] = [];
  private pageSize = 500;
  events = ["BufReadPost", "BufWritePost", "InsertLeave"] as DdcEvent[];

  private async gatherWords(
    denops: Denops,
    endLine: number,
  ): Promise<Candidate[]> {
    const ps = await gather(denops, async (denops) => {
      for (const [s, e] of splitPages(1, endLine, this.pageSize)) {
        await fn.getline(denops, s, e);
      }
    }) as string[][];
    return allWords(ps.flatMap((p) => p)).map((word) => ({ word }));
  }

  private async makeCache(
    denops: Denops,
    filetype: string,
    limit: number,
  ): Promise<void> {
    const endLine = await fn.line(denops, "$");
    const size = (await fn.line2byte(
      denops,
      endLine + 1,
    )) - 1;
    if (size > limit) {
      return;
    }
    const bufnr = await fn.bufnr(denops);

    this.buffers[bufnr] = {
      bufnr: bufnr,
      filetype: filetype,
      candidates: await this.gatherWords(denops, endLine),
    };
  }

  async onInit(args: {
    denops: Denops;
  }): Promise<void> {
    this.makeCache(
      args.denops,
      await fn.getbufvar(args.denops, "%", "&filetype") as string,
      1e6,
    );
  }

  async onEvent(args: {
    denops: Denops;
    context: Context;
    sourceParams: Record<string, unknown>;
  }): Promise<void> {
    await this.makeCache(
      args.denops,
      args.context.filetype,
      args.sourceParams.limitBytes as number,
    );

    const tabBufnrs = (await args.denops.call("tabpagebuflist") as number[]);
    this.buffers = this.buffers.filter(async (buffer) =>
      buffer.bufnr in tabBufnrs ||
      (await fn.buflisted(args.denops, buffer.bufnr))
    );
  }

  async gatherCandidates(args: {
    denops: Denops;
    context: Context;
    sourceParams: Record<string, unknown>;
  }): Promise<Candidate[]> {
    const p = args.sourceParams as unknown as Params;
    const tabBufnrs = (await args.denops.call("tabpagebuflist") as number[]);
    const altbuf = await fn.bufnr(args.denops, "#");
    let buffers = this.buffers.filter((buf) =>
      !p.requireSameFiletype ||
      (buf.filetype == args.context.filetype) ||
      tabBufnrs.includes(buf.bufnr) ||
      (p.fromAltBuf && (altbuf == buf.bufnr))
    );

    return buffers.map((buf) => buf.candidates).flatMap((candidate) =>
      candidate
    );
  }

  params(): Record<string, unknown> {
    const params: Params = {
      requireSameFiletype: true,
      limitBytes: 1e6,
      fromAltBuf: false,
    };
    return params as unknown as Record<string, unknown>;
  }
}

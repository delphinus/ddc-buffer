# ddc-buffer
Buffer source for ddc.vim

This source collects keywords from current buffer, buffers whose window is in the same tabpage and buffers which has the same filetype.

## Required

### denops.vim
https://github.com/vim-denops/denops.vim

### ddc.vim
https://github.com/Shougo/ddc.vim

## Configuration
### params
- requireSameFiletype: If it is false, keywords from all listed buffers are collected. (default: v:true)
If true, buffers which has the same filetype as the current buffer are used. (default: v:true)
- limitBytes: If the byte size of buffer exceeds this number, keywords from it are not collected.
(default: 1000000)
- fromAltBuf: If it is true, keywords from alternate buffer are collected. (default: v:false)

### example
```vim
call ddc#custom#patch_global('sources', ['buffer'])
call ddc#custom#patch_global('sourceOptions', {
    \ '_': {'matchers': ['matcher_head']},
    \ 'buffer': {'mark': 'B'},
    \ })

call ddc#custom#patch_global('filterParams', {
    \ 'buffer': {'requireSameFiletype': v:false},
    \ })
```

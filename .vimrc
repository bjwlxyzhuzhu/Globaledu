" 寰语星球项目：强制以 UTF-8 读写中文文件。
scriptencoding utf-8
set encoding=utf-8
set fileencodings=utf-8,ucs-bom,gb18030,gbk,latin1
set fileencoding=utf-8

" 新文件、已有 UTF-8 文件均保存为 UTF-8；不自动写 BOM。
set nobomb
set fileformat=unix


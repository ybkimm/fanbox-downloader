# fanbox-downloader
pixiv FANBOXの投稿を投稿毎にフォルダ分け → ZIPとして一括ダウンロードするブックマークレット

自分用、性欲駆動開発

### 使い方
- https://furubarug.github.io/fanbox-downloader/

↓ブックマークレット
```
javascript:import("https://furubarug.github.io/fanbox-downloader/fanbox-downloader.min.js").then(m=>m.main());
```

### 既知の問題
- 4GB超えるとZIP解凍時にエラーが出る（解凍ファイルに問題はないけど、うるさいツールだと解凍してくれないかも）

### fork後の変更点
- 対応するURLを少し増やした
- 投稿毎にフォルダ分けしたZIPでダウンロードするよ
- 投稿の文章とかの情報もそれっぽく保存
- コードが長くなったから外部から読み込むようにした


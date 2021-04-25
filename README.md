# fanbox-downloader
pixiv FANBOXの投稿を自動でダウンロードする

自分用、性欲駆動開発

### 使い方
1. ブックマークに追加する
2. FANBOXのクリエイターページか投稿ページで実行する
3. URLのリストがjsonでクリップボードに吐き出される
4. download.fanbox.ccでまた実行、jsonをコピペ
5. なんかいっぱいダウンロードはじまる

### 既知の問題
- type: textに対応してない
- 画像とファイルだけじゃなくて文章も保存したいね
- 画像以外でファイル名の規則が適用されない（たぶんレスポンスヘッダ側のファイル名を優先しちゃってる）

↓ブックマークレット
```
javascript:import("https://furubarug.github.io/fanbox-downloader/fanbox-downloader.min.js").then(m=>m.main());
```

# fanbox-downloader
pixiv FANBOXの投稿を一括ダウンロード → 投稿毎にフォルダ分けして保存する

自分用、性欲駆動開発

### 使い方
1. ブックマークレットをブックマークに追加する
2. FANBOXのクリエイターページか投稿ページで実行する[^1]
3. URLのリストがjsonでクリップボードに吐き出される
4. ダウンロードページ[^2]でまた実行、入力ボックスに3のjsonをコピペ
5. なんかダウンロードはじまる

↓ブックマークレット
```
javascript:import("https://furubarug.github.io/fanbox-downloader/fanbox-downloader.min.js").then(m=>m.main());
```

* <a name="cite-1"></a>\[^1]: `○○○.fanbox.cc`か`fanbox.cc/@○○○`から始まるURLのページ
* <a name="cite-2"></a>\[^2]: `download.fanbox.cc`から始まるURLのページ(画像だと`オリジナルサイズで表示`)

[^1]: #cite-1
[^2]: #cite-2

### 既知の問題
- type: textに対応してない

### fork後の変更点
- 対応するURLを少し増やした
- 投稿毎にフォルダ分けしたZIPでダウンロードするよ
- ダウンロードする投稿数が指定できるようになった
- コードが長くなったから外部から読み込むようにした
- 画像に加えて本文とかも保存する


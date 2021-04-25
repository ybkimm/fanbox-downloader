let dlList = {};
dlList.items = [];
dlList.postCount = 0;
dlList.fileCount = 0;
let isIgnoreFree = false;

// 投稿の情報を個別に取得しない（基本true）
let isEco = true;

function main() {
    if (window.location.origin === "https://downloads.fanbox.cc") {
        document.body.innerHTML = "";
        let tb = document.createElement("input");
        tb.type = "text";
        let bt = document.createElement("input");
        bt.type = "button";
        bt.value = "ok";
        document.body.appendChild(tb);
        document.body.appendChild(bt);
        bt.onclick = function () {
            JSON.parse(tb.value).items.forEach(dl => {
                createLink(dl.url, dl.filename);
            });
            startDownload();
        };

    } else if (window.location.origin === "https://www.fanbox.cc") {
        if (window.location.href.match(/fanbox.cc\/@.*\/posts\/(\d*)/) == null) {
            const id = window.location.href.match(/fanbox.cc\/@(.*)/)[1];
            getItemsById(id);
        } else {
            const id = window.location.href.match(/fanbox.cc\/@.*\/posts\/(\d*)/)[1];
            addByPostInfo(getPostInfoById(id));
        }
        const json = JSON.stringify(dlList);
        navigator.clipboard.writeText(json);
        console.log(json);
        alert("jsonをコピーしました。downloads.fanbox.ccで実行して貼り付けてね");
    } else {
        alert("ここどこですか");
    }
}

// 投稿リストURLからURLリストに追加
function addByPostListUrl(url, eco) {
    const postList = JSON.parse(fetchUrl(url));
    const items = postList.body.items;

    console.log("投稿の数:" + items.length);
    for (let i = 0; i < items.length; i++) {
        dlList.postCount++;
        // ecoがtrueならpostInfoを個別に取得しない
        if (eco === true) {
            console.log(items[i]);
            addByPostInfo(items[i]);
        } else {
            addByPostInfo(getPostInfoById(items[i].id));
        }

    }
    return postList.body.nextUrl;
}

// HTTP GETするおまじない
function fetchUrl(url) {
    const request = new XMLHttpRequest();
    request.open('GET', url, false);
    request.withCredentials = true;
    request.send(null);
    return request.responseText;
}

// 投稿IDからitemsを得る
function getItemsById(postId) {
    dlList.items = [];
    isIgnoreFree = confirm("無料コンテンツを省く？");

    let limit = prompt("取得制限数(最大300)を入力 キャンセルで最後まで取得");
    if (limit == null) {
        let count = 1, nextUrl;
        nextUrl = "https://api.fanbox.cc/post.listCreator?creatorId=" + postId + "&limit=100";
        for (; nextUrl != null; count++) {
            console.log(count + "回目");
            nextUrl = addByPostListUrl(nextUrl, isEco);
        }
    } else {
        // limit=300が限界らしい？
        addByPostListUrl("https://api.fanbox.cc/post.listCreator?creatorId=" + postId + "&limit=" + limit, isEco);
    }
}

// 投稿IDからpostInfoを得る
function getPostInfoById(postId) {
    return JSON.parse(fetchUrl("https://api.fanbox.cc/post.info?postId=" + postId)).body;
}

// postInfoオブジェクトからURLリストに追加する
function addByPostInfo(postInfo) {
    const title = postInfo.title;
    // クリエイター名より日付入ってたほうがうれしいのでかえた（きまぐれ）

    const date = postInfo.publishedDatetime;
    if (isIgnoreFree && (postInfo.feeRequired === 0)) {
        return;
    }

    if (postInfo.body == null) {
        console.log("取得できませんでした(支援がたりない？)\n" + "feeRequired: " + postInfo.feeRequired + "@" + postInfo.id);
        return;
    }

    if (postInfo.type === "image") {
        const images = postInfo.body.images;
        for (let i = 0; i < images.length; i++) {
            addUrl(images[i].originalUrl, date + " " + title + " " + (i + 1) + "." + images[i].extension);
        }
    } else if (postInfo.type === "file") {
        const files = postInfo.body.files;
        for (let i = 0; i < files.length; i++) {
            addUrl(files[i].url, date + " " + title + " " + files[i].name + "." + files[i].extension);
        }
    } else if (postInfo.type === "article") {
        const imageMap = postInfo.body.imageMap;
        const imageMapKeys = Object.keys(imageMap);
        for (let i = 0; i < imageMapKeys.length; i++) {
            addUrl(imageMap[imageMapKeys[i]].originalUrl, date + " " + title + " " + (i + 1) + "." + imageMap[imageMapKeys[i]].extension);
        }

        const fileMap = postInfo.body.fileMap;
        const fileMapKeys = Object.keys(fileMap);
        for (let i = 0; i < fileMapKeys.length; i++) {
            addUrl(fileMap[fileMapKeys[i]].url, date + " " + title + " " + fileMap[fileMapKeys[i]].name + "." + fileMap[fileMapKeys[i]].extension);
        }
    } else {
        console.log("不明なタイプ\n" + postInfo.type + "@" + postInfo.id);
    }
}

// URLリストに追加
function addUrl(url, filename) {
    const dl = {};
    dl.url = url;
    dl.filename = filename;

    dlList.fileCount++;
    dlList.items.push(dl);
}

// ダウンロードリンクを作成
function createLink(url, filename) {
    const a = document.createElement("a");
    document.body.appendChild(a);
    a.href = url;
    a.download = filename;
}

// ダウンロードリンクをクリックする
function startDownload() {
    const links = document.querySelectorAll("a");
    let idx = 0;
    const interval = setInterval(function () {
        links[idx].click();
        idx++;
        if (idx >= links.length) clearInterval(interval);
    }, 300);
}

main();

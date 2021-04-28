let dlList = {posts: {}, postCount: 0, fileCount: 0, id: 'undefined'};
let limit = 0;
let isIgnoreFree = false;

// 投稿の情報を個別に取得しない（基本true）
let isEco = true;

// メイン
export async function main() {
    if (window.location.origin === "https://downloads.fanbox.cc") {
        document.body.innerHTML = "";
        let tb = document.createElement("input");
        tb.type = "text";
        let bt = document.createElement("input");
        bt.type = "button";
        bt.value = "ok";
        let pr = document.createElement("progress");
        pr.max = 100;
        pr.value = 0;
        let br = document.createElement("br");
        let tx = document.createElement("textarea");
        tx.value = "";
        tx.cols = 40;
        tx.readOnly = true;
        document.body.appendChild(tb);
        document.body.appendChild(bt);
        document.body.appendChild(pr);
        document.body.appendChild(br);
        document.body.appendChild(tx);
        const progress = (v) => pr.value = v;
        const textLog = (t) => {
            tx.value += `${t}\n`;
            tx.scrollTop = tx.scrollHeight;
        };
        bt.onclick = function () {
            downloadZip(tb.value, progress, textLog).then(() => {
            });
        };
        return;
    } else if (window.location.origin === "https://www.fanbox.cc") {
        const userId = window.location.href.match(/fanbox.cc\/@(.*)/)[1];
        if (userId == null) {
            alert("しらないURL");
            return;
        }
        dlList.id = userId;
        const postId = window.location.href.match(/fanbox.cc\/@.*\/posts\/(\d*)/);
        if (postId) addByPostInfo(getPostInfoById(postId[1]));
        else await getItemsById(userId);
    } else if (window.location.href.match(/^https:\/\/(.*)\.fanbox\.cc\//)) {
        const userId = window.location.href.match(/^https:\/\/(.*)\.fanbox\.cc\//)[1];
        const postId = window.location.href.match(/.*\.fanbox\.cc\/posts\/(\d*)/);
        dlList.id = userId;
        if (postId) addByPostInfo(getPostInfoById(postId[1]));
        else await getItemsById(userId);
    } else {
        alert(`ここどこですか(${window.location.href})`);
        return;
    }
    const json = JSON.stringify(dlList);
    console.log(json);
    await navigator.clipboard.writeText(json);
    alert("jsonをコピーしました。downloads.fanbox.ccで実行して貼り付けてね");
}

// 投稿リストURLからURLリストに追加
function addByPostListUrl(url, eco) {
    const postList = JSON.parse(fetchUrl(url));
    const items = postList.body.items;

    console.log("投稿の数:" + items.length);
    for (let i = 0; i < items.length && limit !== 0; i++) {
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
async function getItemsById(postId) {
    isIgnoreFree = confirm("無料コンテンツを省く？");
    limit = prompt("取得制限数を入力 キャンセルで全て取得");
    let count = 1, nextUrl;
    nextUrl = `https://api.fanbox.cc/post.listCreator?creatorId=${postId}&limit=100`;
    for (; nextUrl != null; count++) {
        console.log(count + "回目");
        nextUrl = addByPostListUrl(nextUrl, isEco);
        await setTimeout(() => {
        }, 100);
    }
}

// 投稿IDからpostInfoを得る
function getPostInfoById(postId) {
    return JSON.parse(fetchUrl(`https://api.fanbox.cc/post.info?postId=${postId}`)).body;
}

// postInfoオブジェクトからURLリストに追加する
function addByPostInfo(postInfo) {
    const title = postInfo.title;
    if (isIgnoreFree && (postInfo.feeRequired === 0)) {
        return;
    }

    if (postInfo.body == null) {
        console.log(`取得できませんでした(支援がたりない？)\nfeeRequired: ${postInfo.feeRequired}@${postInfo.id}`);
        return;
    }

    // 情報保存と初期化
    const info = `id: ${postInfo.id}\ntitle: ${title}\nfee: ${postInfo.feeRequired}\n` +
        `publishedDatetime: ${postInfo.publishedDatetime}\nupdatedDatetime: ${postInfo.updatedDatetime}\n` +
        `tags: ${postInfo.tags.join(', ')}\nexcerpt:\n${postInfo.excerpt}\nbody:\n${postInfo.body.text}\n`;
    dlList.posts[title] = {info, items: []};
    const cover = postInfo.coverImageUrl;
    if (cover) {
        addUrl(title, cover, `cover.${cover.split('.').pop()}`);
    }

    if (postInfo.type === "image") {
        const images = postInfo.body.images;
        for (let i = 0; i < images.length; i++) {
            addUrl(title, images[i].originalUrl, `${title} ${i + 1}.${images[i].extension}`);
        }
    } else if (postInfo.type === "file") {
        const files = postInfo.body.files;
        for (let i = 0; i < files.length; i++) {
            addUrl(title, files[i].url, `${title} ${files[i].name}.${files[i].extension}`);
        }
    } else if (postInfo.type === "article") {
        const imageMap = postInfo.body.imageMap;
        const imageMapKeys = Object.keys(imageMap);
        for (let i = 0; i < imageMapKeys.length; i++) {
            addUrl(title, imageMap[imageMapKeys[i]].originalUrl, `${title} ${i + 1}.${imageMap[imageMapKeys[i]].extension}`);
        }

        const fileMap = postInfo.body.fileMap;
        const fileMapKeys = Object.keys(fileMap);
        for (let i = 0; i < fileMapKeys.length; i++) {
            addUrl(title, fileMap[fileMapKeys[i]].url, `${title} ${fileMap[fileMapKeys[i]].name}.${fileMap[fileMapKeys[i]].extension}`);
        }
    } else {
        console.log(`不明なタイプ\n${postInfo.type}@${postInfo.id}`);
    }
    if (limit != null) limit--;
}

// URLリストに追加
function addUrl(title, url, filename) {
    dlList.fileCount++;
    dlList.posts[title].items.push({url, filename});
}

// スクリプトの読み込み
async function script(url) {
    return new Promise((resolve, reject) => {
        let script = document.createElement("script");
        script.src = url;
        script.onload = () => resolve(script);
        script.onerror = (e) => reject(e);
        document.head.appendChild(script);
    });
}

// ZIPでダウンロード
async function downloadZip(json, progress, log) {
    dlList = JSON.parse(json);
    await script('https://cdn.jsdelivr.net/npm/web-streams-polyfill@2.0.2/dist/ponyfill.min.js');
    await script('https://cdn.jsdelivr.net/npm/streamsaver@2.0.3/StreamSaver.js');
    await script('https://cdn.jsdelivr.net/npm/streamsaver@2.0.3/examples/zip-stream.js');

    const fileStream = streamSaver.createWriteStream(`${dlList.id}.zip`);
    const readableZipStream = new createWriter({
        async pull(ctrl) {
            let count = 0;
            log(`@${dlList.id} 投稿:${dlList.postCount} ファイル:${dlList.fileCount}`);
            for (const [title, post] of Object.entries(dlList.posts)) {
                ctrl.enqueue(new File([post.info], `${dlList.id}/${title}/info.txt`));
                let i = 1, l = post.items.length;
                for (const dl of post.items) {
                    log(`download ${dl.filename} (${i++}/${l})`)
                    const response = await fetch(dl.url);
                    ctrl.enqueue({name: `${dlList.id}/${title}/${dl.filename}`, stream: () => response.body})
                    count++;
                    await setTimeout(() => progress(count * 100 / dlList.fileCount | 0), 0);
                    await setTimeout(() => {
                    }, 100);
                }
                log(`${count * 100 / dlList.fileCount | 0}% (${count}/${dlList.fileCount})`);
            }
            ctrl.close()
        }
    });

    // more optimized
    if (window.WritableStream && readableZipStream.pipeTo) {
        return readableZipStream.pipeTo(fileStream).then(() => console.log('done writing'))
    }

    // less optimized
    const writer = fileStream.getWriter();
    const reader = readableZipStream.getReader();
    const pump = () => reader.read().then(res => res.done ? writer.close() : writer.write(res.value).then(pump));
    pump();
}

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
        await sleep(100);
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
        `tags: ${postInfo.tags.join(', ')}\nexcerpt:\n${postInfo.excerpt}\ntxt:\n`;
    const coverUrl = postInfo.coverImageUrl;
    const cover = coverUrl ? {url: coverUrl, filename: `cover.${coverUrl.split('.').pop()}`} : undefined;
    const html = (cover ? createImg(cover.filename) : '') + createTitle(title);
    dlList.posts[title] = {info, items: [], html, cover};

    if (postInfo.type === "image") {
        const images = postInfo.body.images;
        // html
        dlList.posts[title].html += postInfo.body.text.split("\n").map(it => `<span>${it}</span>`).join("<br>\n") +
            images.map((it, i) => createImg(`${title} ${i + 1}.${it.extension}`));
        dlList.posts[title].info += `${postInfo.body.text}\n`;

        for (let i = 0; i < images.length; i++) {
            addUrl(title, images[i].originalUrl, `${title} ${i + 1}.${images[i].extension}`);
        }
    } else if (postInfo.type === "file") {
        const files = postInfo.body.files;
        // html
        dlList.posts[title].html += 'not implemented';
        dlList.posts[title].info += `not implemented\n`;
        for (let i = 0; i < files.length; i++) {
            addUrl(title, files[i].url, `${title} ${files[i].name}.${files[i].extension}`);
        }
    } else if (postInfo.type === "article") {
        const imageOrder = postInfo.body.blocks.filter(it => it.type === 'image').map(it => it.imageId);
        const imageKeyOrder = (n) => imageOrder.indexOf(n) ?? imageOrder.length;
        const imageMap = postInfo.body.imageMap;
        const imageMapKeys = Object.keys(imageMap).sort((a, b) => imageKeyOrder(a) - imageKeyOrder(b));
        for (let i = 0; i < imageMapKeys.length; i++) {
            addUrl(title, imageMap[imageMapKeys[i]].originalUrl, `${title} ${i + 1}.${imageMap[imageMapKeys[i]].extension}`);
        }
        const fileOrder = postInfo.body.blocks.filter(it => it.type === 'file').map(it => it.fileId);
        const fileKeyOrder = (s) => fileOrder.indexOf(s) ?? fileOrder.length;
        const fileMap = postInfo.body.fileMap;
        const fileMapKeys = Object.keys(fileMap).sort((a, b) => fileKeyOrder(a) - fileKeyOrder(b));
        for (let i = 0; i < fileMapKeys.length; i++) {
            addUrl(title, fileMap[fileMapKeys[i]].url, `${title} ${fileMap[fileMapKeys[i]].name}.${fileMap[fileMapKeys[i]].extension}`);
        }

        // html
        let cntImg = 0, cntFile = 0;
        dlList.posts[title].html += postInfo.body.blocks.map(it => {
            switch (it.type) {
                case 'p':
                    return `<span>${it.text}</span>`;
                case 'header':
                    return `<h2><span>${it.text}</span></h2>`;
                case 'file':
                    const fileName = `${title} ${fileMap[fileMapKeys[cntFile]].name}.${fileMap[fileMapKeys[cntFile]].extension}`;
                    cntFile++;
                    return `<span><a href="./${fileName}">${fileName}</a></span>`;
                case 'image':
                    const imgName = `${title} ${cntImg + 1}.${imageMap[imageMapKeys[cntImg]].extension}`;
                    cntImg++;
                    return createImg(imgName);
                default:
                    return 'not implemented';
            }
        }).join("<br>\n");
        dlList.posts[title].info += postInfo.body.blocks.filter(it => it.text !== undefined).map(it => it.text).join("\n");
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

async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
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

// fetch
async function download({url, filename}, limit) {
    if (limit < 0) return null;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`DL失敗: ${filename}, ${url}`);
            await sleep(1000);
            return await download({url, filename}, limit - 1);
        } else return response;
    } catch (_) {
        console.error(`通信エラー: ${filename}, ${url}`);
        await sleep(1000);
        return await download({url, filename}, limit - 1);
    }
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
            // root htmlの作成
            const rootBody = Object.entries(dlList.posts).map(([title, post]) => createCard(title, post.cover)).join('\n');
            ctrl.enqueue(new File([createHtml(dlList.id, rootBody)], `${dlList.id}/index.html`));

            for (const [title, post] of Object.entries(dlList.posts)) {
                ctrl.enqueue(new File([post.info], `${dlList.id}/${title}/info.txt`));
                ctrl.enqueue(new File([createHtml(title, post.html)], `${dlList.id}/${title}/index.html`));
                // カバー画像
                if (post.cover) {
                    log(`download ${post.cover.filename}`);
                    const response = await download(post.cover, 1);
                    if (response) {
                        ctrl.enqueue({
                            name: `${dlList.id}/${title}/${post.cover.filename}`,
                            stream: () => response.body
                        });
                    }
                }
                // ファイル処理
                let i = 1, l = post.items.length;
                for (const dl of post.items) {
                    log(`download ${dl.filename} (${i++}/${l})`);
                    const response = await download(dl, 1);
                    if (response) {
                        ctrl.enqueue({name: `${dlList.id}/${title}/${dl.filename}`, stream: () => response.body});
                    } else {
                        console.error(`${dl.filename}(${dl.url})のダウンロードに失敗、読み飛ばすよ`);
                        log(`${dl.filename}のダウンロードに失敗`);
                    }
                    count++;
                    await setTimeout(() => progress(count * 100 / dlList.fileCount | 0), 0);
                    await sleep(100);
                }
                log(`${count * 100 / dlList.fileCount | 0}% (${count}/${dlList.fileCount})`);
            }
            ctrl.close();
        }
    });

    // more optimized
    if (window.WritableStream && readableZipStream.pipeTo) {
        return readableZipStream.pipeTo(fileStream).then(() => console.log('done writing'));
    }

    // less optimized
    const writer = fileStream.getWriter();
    const reader = readableZipStream.getReader();
    const pump = () => reader.read().then(res => res.done ? writer.close() : writer.write(res.value).then(pump));
    pump();
}

function createTitle(title) {
    return `<h5>${title}</h5>\n`;
}

function createImg(filename) {
    return `<a class="hl" href="./${filename}"><div class="post card">\n` +
        `<img class="card-img-top" src="./${filename}"/>\n</div></a><br>\n`;
}

function createCard(title, cover) {
    return `<a class="hl" href="./${title}/index.html"><div class="root card">\n` +
        `<img class="card-img-top gray-card" ${cover ? `src="./${title}/${cover.filename}"` : ''}/>\n` +
        `<div class="card-body"><h5 class="card-title">${title}</h5></div>\n</div></a><br>\n`;
}

function createHtml(title, body) {
    return `<!DOCTYPE html>\n<html lang="ja">\n<head>\n<meta charset="utf-8" />\n<title>${title}</title>\n` +
        '<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.0-beta1/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-giJF6kkoqNQ00vy+HMDP7azOuL0xtbfIcaT9wjKHr8RbDVddVHyTfAAsrekwKmP1" crossOrigin="anonymous">\n' +
        '<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.0.0-beta1/dist/js/bootstrap.bundle.min.js" integrity="sha384-ygbV9kiqUc6oa4msXn9868pTtWMgiQaeYH7/t7LECLbyPA2x65Kgf80OJFdroafW" crossOrigin="anonymous"></script>\n' +
        '<style>div.main{width: 600px; float: none; margin: 0 auto} a.hl,a.hl:hover {color: inherit;text-decoration: none;}div.root{width: 400px} dive.post{width: 600px}div.card {float: none; margin: 0 auto;}img.gray-card {height: 210px;background-color: gray;}</style>\n' +
        `</head>\n<body>\n<div class="main">\n${body}\n</div>\n</body></html>`;
}

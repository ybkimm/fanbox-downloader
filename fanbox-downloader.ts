import {DownloadHelper, DownloadObj, PostObj} from 'download-helper/download-helper';

let dlList: DownloadObj = {posts: {}, postCount: 0, fileCount: 0, id: 'undefined'};
let limit: number | null = 0;
let isIgnoreFree = false;

// 投稿の情報を個別に取得しない（基本true）
const isEco = true;

const getImageName = (img: ImageInfo, title: string, index: number) => `${title} ${index + 1}.${img.extension}`;
const getFileName = (file: FileInfo, title: string, index: number) => `${title} ${file.name}.${file.extension}`;
const helper = new DownloadHelper();

// メイン
export async function main() {
    if (window.location.origin === "https://downloads.fanbox.cc") {
        await helper.createDownloadUI('fanbox-downloader');
        return;
    } else if (window.location.origin === "https://www.fanbox.cc") {
        const userId = window.location.href.match(/fanbox.cc\/@([^\/]*)/)?.[1];
        const postId = window.location.href.match(/fanbox.cc\/@.*\/posts\/(\d*)/)?.[1];
        await searchBy(userId, postId);
    } else if (window.location.href.match(/^https:\/\/(.*)\.fanbox\.cc\//)) {
        const userId = window.location.href.match(/^https:\/\/(.*)\.fanbox\.cc\//)?.[1];
        const postId = window.location.href.match(/.*\.fanbox\.cc\/posts\/(\d*)/)?.[1];
        await searchBy(userId, postId);
    } else {
        alert(`ここどこですか(${window.location.href})`);
        return;
    }
    const json = JSON.stringify(dlList);
    console.log(json);
    await navigator.clipboard.writeText(json);
    alert("jsonをコピーしました。downloads.fanbox.ccで実行して貼り付けてね");
    if (confirm("downloads.fanbox.ccに遷移する？")) {
        document.location.href = "https://downloads.fanbox.cc";
    }
}

/**
 * 投稿情報を取得して userId に入れる
 * @param userId ユーザーID
 * @param postId 投稿ID
 */
async function searchBy(userId: string | undefined, postId: string | undefined) {
    if (!userId) {
        alert("しらないURL");
        return;
    }
    dlList.id = userId;
    if (postId) addByPostInfo(getPostInfoById(postId));
    else await getItemsById(userId);
}

/**
 * 投稿リストURLからURLリストに追加
 * @param url
 * @param eco trueならpostInfoを個別に取得しない
 */
function addByPostListUrl(url: string, eco: boolean) {
    const postList = JSON.parse(fetchUrl(url));
    const items = postList.body.items;

    console.log("投稿の数:" + items.length);
    for (let i = 0; i < items.length && limit !== 0; i++) {
        dlList.postCount++;
        if (eco) {
            console.log(items[i]);
            addByPostInfo(items[i]);
        } else {
            addByPostInfo(getPostInfoById(items[i].id));
        }
    }
    return postList.body.nextUrl;
}

/**
 * HTTP GET用
 * @param url
 */
function fetchUrl(url: string) {
    const request = new XMLHttpRequest();
    request.open('GET', url, false);
    request.withCredentials = true;
    request.send(null);
    return request.responseText;
}

/**
 * 投稿IDからitemsを得る
 * @param postId 投稿ID
 */
async function getItemsById(postId: string) {
    isIgnoreFree = confirm("無料コンテンツを省く？");
    const limitBase = prompt("取得制限数を入力 キャンセルで全て取得");
    limit = limitBase ? Number.parseInt(limitBase) : null;
    let count = 1, nextUrl = `https://api.fanbox.cc/post.listCreator?creatorId=${postId}&limit=100`;
    for (; nextUrl != null; count++) {
        console.log(count + "回目");
        nextUrl = addByPostListUrl(nextUrl, isEco);
        await helper.sleep(100);
    }
}

/**
 * 投稿IDからpostInfoを得る
 * @param postId 投稿ID
 */
function getPostInfoById(postId: string): PostInfo | undefined {
    return JSON.parse(fetchUrl(`https://api.fanbox.cc/post.info?postId=${postId}`)).body;
}

/**
 * postInfoオブジェクトからURLリストに追加する
 * @param postInfo 投稿情報オブジェクト
 */
function addByPostInfo(postInfo: PostInfo | undefined) {
    if (!postInfo || (isIgnoreFree && (postInfo.feeRequired === 0))) {
        return;
    }
    if (!postInfo.body) {
        console.log(`取得できませんでした(支援がたりない？)\nfeeRequired: ${postInfo.feeRequired}@${postInfo.id}`);
        return;
    }
    const postObj = createPostObj(postInfo);
    const title = postInfo.title;

    if (postInfo.type === "image") {
        const images = postInfo.body.images;
        for (let i = 0; i < images.length; i++) {
            addUrl(postObj, images[i].originalUrl, getImageName(images[i], title, i));
        }
    } else if (postInfo.type === "file") {
        const files = postInfo.body.files;
        for (let i = 0; i < files.length; i++) {
            addUrl(postObj, files[i].url, getFileName(files[i], title, i));
        }
    } else if (postInfo.type === "article") {
        const images = convertImageMap(postInfo.body.imageMap, postInfo.body.blocks);
        for (let i = 0; i < images.length; i++) {
            addUrl(postObj, images[i].originalUrl, getImageName(images[i], title, i));
        }
        const files = convertFileMap(postInfo.body.fileMap, postInfo.body.blocks);
        for (let i = 0; i < files.length; i++) {
            addUrl(postObj, files[i].url, getFileName(files[i], title, i));
        }
    } else {
        console.log(`不明なタイプ\n${postInfo.type}@${postInfo.id}`);
    }
    if (limit != null) limit--;
}

/**
 * dlListの投稿情報を初期化する
 * @param postInfo 投稿情報オブジェクト
 * @return 投稿オブジェクト
 */
function createPostObj(postInfo: PostInfo): PostObj {
    const info = createInfoFromPostInfo(postInfo);
    const coverUrl = postInfo.coverImageUrl;
    const cover = coverUrl ? {url: coverUrl, filename: `cover.${coverUrl.split('.').pop()}`} : undefined;
    const html = createPostHtmlFromPostInfo(postInfo, cover?.filename);
    const postObj = {info, items: [], html, cover};
    let title = postInfo.title;
    if (dlList.posts[title]) {
        let i = 2;
        while (dlList.posts[`${title}_${i}`]) i++;
        title = `${title}_${i}`;
    }
    dlList.posts[title] = postObj;
    return postObj;
}

/**
 * URLリストに追加
 * @param postObj 投稿オブジェクト
 * @param url
 * @param filename
 */
function addUrl(postObj: PostObj, url: string, filename: string) {
    dlList.fileCount++;
    postObj.items.push({url, filename});
}

function convertImageMap(imageMap: Record<string, ImageInfo>, blocks: Block[]): ImageInfo[] {
    const imageOrder = blocks.filter((it): it is ImageBlock => it.type === "image").map(it => it.imageId);
    const imageKeyOrder = (s: string) => imageOrder.indexOf(s) ?? imageOrder.length;
    return Object.keys(imageMap).sort((a, b) => imageKeyOrder(a) - imageKeyOrder(b)).map(it => imageMap[it]);
}

function convertFileMap(fileMap: Record<string, FileInfo>, blocks: Block[]): FileInfo[] {
    const fileOrder = blocks.filter((it): it is FileBlock => it.type === 'file').map(it => it.fileId);
    const fileKeyOrder = (s: string) => fileOrder.indexOf(s) ?? fileOrder.length;
    return Object.keys(fileMap).sort((a, b) => fileKeyOrder(a) - fileKeyOrder(b)).map(it => fileMap[it]);
}

function convertEmbedMap(embedMap: Record<string, EmbedInfo>, blocks: Block[]): EmbedInfo[] {
    const embedOrder = blocks.filter((it): it is EmbedBlock => it.type === "embed").map(it => it.embedId);
    const embedKeyOrder = (s: string) => embedOrder.indexOf(s) ?? embedOrder.length;
    return Object.keys(embedMap).sort((a, b) => embedKeyOrder(a) - embedKeyOrder(b)).map(it => embedMap[it]);
}

/**
 * postInfoオブジェクトから投稿情報テキストを作る
 * @param postInfo 投稿情報オブジェクト
 * @return 投稿情報テキスト
 */
function createInfoFromPostInfo(postInfo: PostInfo): string {
    const txt: string = (() => {
        switch (postInfo.type) {
            case "image":
                return `${postInfo.body.text}\n`;
            case "file":
                return `not implemented\n`;
            case "article":
                return postInfo.body.blocks
                    .filter((it): it is TextBlock => it.type === "p" || it.type === "header")
                    .map(it => it.text)
                    .join("\n");
            default:
                return `undefined type\n`;
        }
    })();
    return `id: ${postInfo.id}\ntitle: ${postInfo.title}\nfee: ${postInfo.feeRequired}\n` +
        `publishedDatetime: ${postInfo.publishedDatetime}\nupdatedDatetime: ${postInfo.updatedDatetime}\n` +
        `tags: ${postInfo.tags.join(', ')}\nexcerpt:\n${postInfo.excerpt}\ntxt:\n${txt}\n`;
}


// postInfoオブジェクトから投稿再現htmlを作る
function createPostHtmlFromPostInfo(postInfo: PostInfo, coverFilename?: string): string {
    const header: string = (coverFilename ? createImg(coverFilename) : '') + createTitle(postInfo.title);
    const body: string = (() => {
        switch (postInfo.type) {
            case "image":
                return postInfo.body.images.map((it, i) => createImg(getImageName(it, postInfo.title, i))).join("<br>\n") +
                    postInfo.body.text.split("\n").map(it => `<span>${it}</span>`).join("<br>\n");
            case "file":
                return postInfo.body.files.map((it, i) => createFile(getFileName(it, postInfo.title, i))).join("<br>\n") +
                    postInfo.body.text.split("\n").map(it => `<span>${it}</span>`).join("<br>\n");
            case "article":
                let cntImg = 0, cntFile = 0, cntEmbed = 0;
                const files = convertFileMap(postInfo.body.fileMap, postInfo.body.blocks);
                const images = convertImageMap(postInfo.body.imageMap, postInfo.body.blocks);
                const embeds = convertEmbedMap(postInfo.body.embedMap, postInfo.body.blocks);
                return postInfo.body.blocks.map(it => {
                    switch (it.type) {
                        case 'p':
                            return `<span>${it.text}</span>`;
                        case 'header':
                            return `<h2><span>${it.text}</span></h2>`;
                        case 'file':
                            const filename = getFileName(files[cntFile], postInfo.title, cntFile);
                            cntFile++;
                            return createFile(filename);
                        case 'image':
                            const imgName = getImageName(images[cntImg], postInfo.title, cntImg);
                            cntImg++;
                            return createImg(imgName);
                        case "embed":
                            // FIXME 型が分からないので取りあえず文字列に投げて処理
                            return `<span>${embeds[cntEmbed++]}</span>`;
                        default:
                            return console.error(`unknown block type: ${it.type}`);
                    }
                }).join("<br>\n");
            case "text": // FIXME 型が分からないので適当に書いてる
                if (postInfo.body.text) {
                    return postInfo.body.text.split("\n").map(it => `<span>${it}</span>`).join("<br>\n");
                } else if (postInfo.body.blocks) {
                    return postInfo.body.blocks.map(it => {
                        switch (it.type) {
                            case 'header':
                                return `<h2><span>${it.text}</span></h2>`;
                            case 'p':
                                return `<span>${it.text}</span>`;
                            default:
                                return '';
                        }
                    }).join("<br>\n");
                } else return '';
            default:
                return `undefined type\n`;
        }
    })();
    return header + body;
}

// タイトル
function createTitle(title: string): string {
    return `<h5>${title}</h5>\n`;
}

// 画像表示
function createImg(filename: string): string {
    return `<a class="hl" href="${helper.encodeLink('.', filename)}"><div class="post card">\n` +
        `<img class="card-img-top" src="${helper.encodeLink('.', filename)}"/>\n</div></a>`;
}

// ファイル表示
function createFile(filename: string): string {
    return `<span><a href="${helper.encodeLink('.', filename)}">${filename}</a></span>`;
}

type PostInfo = {
    title: string,
    feeRequired: number,
    id: string,
    coverImageUrl: string | null,
    excerpt: string,
    tags: string[],
    // DateはJSON.parseで文字列扱い
    publishedDatetime: string,
    updatedDatetime: string,
} & ({
    type: "image",
    body: { text: string, images: ImageInfo[] },
} | {
    type: "file",
    body: { text: string, files: FileInfo[] }, // TODO textが存在するか要確認
} | {
    type: "article",
    body: { imageMap: Record<string, ImageInfo>, fileMap: Record<string, FileInfo>, embedMap: Record<string, EmbedInfo>, blocks: Block[] },
} | {
    type: "text",
    body: { text?: string, blocks?: Block[] }, // FIXME 中身が分からないので想像で書いてる
} | {
    type: "unknown",
    body: {},
});
type ImageInfo = { originalUrl: string, extension: string };
type FileInfo = { url: string, name: string, extension: string };
type EmbedInfo = any; // FIXME
type ImageBlock = { type: 'image', imageId: string };
type FileBlock = { type: "file", fileId: string };
type TextBlock = { type: "p" | "header", text: string };
type EmbedBlock = { type: "embed", embedId: string };
type UnknownBlock = { type: "unknown" }; // 他の型がありそうなので入れてる default句で使ってるのでコンパイルすると型が消えて他のを除いた全部に対応する
type Block = ImageBlock | FileBlock | TextBlock | EmbedBlock | UnknownBlock;

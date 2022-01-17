import {DownloadHelper, DownloadObject, DownloadUtils} from 'download-helper/download-helper';

let limit: number | null = 0;
let isIgnoreFree = false;

// 投稿の情報を個別に取得しない（基本true）
const isEco = true;

const utils = new DownloadUtils();

// メイン
export async function main() {
    let downloadObject: DownloadObject | null = null;
    if (window.location.origin === "https://downloads.fanbox.cc") {
        await new DownloadHelper(utils).createDownloadUI('fanbox-downloader');
        return;
    } else if (window.location.origin === "https://www.fanbox.cc") {
        const userId = window.location.href.match(/fanbox.cc\/@([^\/]*)/)?.[1];
        const postId = window.location.href.match(/fanbox.cc\/@.*\/posts\/(\d*)/)?.[1];
        downloadObject = await searchBy(userId, postId);
    } else if (window.location.href.match(/^https:\/\/(.*)\.fanbox\.cc\//)) {
        const userId = window.location.href.match(/^https:\/\/(.*)\.fanbox\.cc\//)?.[1];
        const postId = window.location.href.match(/.*\.fanbox\.cc\/posts\/(\d*)/)?.[1];
        downloadObject = await searchBy(userId, postId);
    } else {
        alert(`ここどこですか(${window.location.href})`);
        return;
    }
    if (!downloadObject) return;
    const json = downloadObject.stringify();
    console.log(json);
    await navigator.clipboard.writeText(json); // TODO windowが非アクティブ時の対応
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
async function searchBy(userId: string | undefined, postId: string | undefined): Promise<DownloadObject | null> {
    if (!userId) {
        alert("しらないURL");
        return null;
    }
    const downloadObject = new DownloadObject(userId, utils);
    if (postId) addByPostInfo(downloadObject, getPostInfoById(postId));
    else await getItemsById(downloadObject, userId);
    return downloadObject;
}

/**
 * 投稿リストURLからURLリストに追加
 * @param downloadObject
 * @param url
 * @param eco trueならpostInfoを個別に取得しない
 */
function addByPostListUrl(downloadObject: DownloadObject, url: string, eco: boolean) {
    const postList = JSON.parse(fetchUrl(url));
    const items = postList.body.items;

    console.log("投稿の数:" + items.length);
    for (let i = 0; i < items.length && limit !== 0; i++) {
        if (eco) {
            console.log(items[i]);
            addByPostInfo(downloadObject, items[i]);
        } else {
            addByPostInfo(downloadObject, getPostInfoById(items[i].id));
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
 * @param downloadObject 結果格納用オブジェクト
 * @param postId 投稿ID
 */
async function getItemsById(downloadObject: DownloadObject, postId: string) {
    isIgnoreFree = confirm("無料コンテンツを省く？");
    const limitBase = prompt("取得制限数を入力 キャンセルで全て取得");
    limit = limitBase ? Number.parseInt(limitBase) : null;
    let count = 1, nextUrl = `https://api.fanbox.cc/post.listCreator?creatorId=${postId}&limit=100`;
    for (; nextUrl != null; count++) {
        console.log(count + "回目");
        nextUrl = addByPostListUrl(downloadObject, nextUrl, isEco);
        await utils.sleep(100);
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
 * @param downloadObject 結果格納用オブジェクト
 * @param postInfo 投稿情報オブジェクト
 */
function addByPostInfo(downloadObject: DownloadObject, postInfo: PostInfo | undefined) {
    if (!postInfo || (isIgnoreFree && (postInfo.feeRequired === 0))) {
        return;
    }
    if (!postInfo.body) {
        console.log(`取得できませんでした(支援がたりない？)\nfeeRequired: ${postInfo.feeRequired}@${postInfo.id}`);
        return;
    }
    const postName = postInfo.title;
    const postObject = downloadObject.addPost(postName);
    const header: string = ((url: string | null) => {
        if (url) {
            const ext = url.split('.').pop() ?? "";
            return `${postObject.getImageLinkTag(postObject.setCover("cover", ext, url))}<h5>${postName}</h5>\n`
        }
        return `<h5>${postName}</h5>\n`;
    })(postInfo.coverImageUrl);
    postObject.setInfo(createInfoFromPostInfo(postInfo));

    switch (postInfo.type) {
        case "image": {
            const images = postInfo.body.images.map(it => postObject.addFile(postName, it.extension, it.originalUrl));
            const imageTags = images.map(it => postObject.getImageLinkTag(it)).join("<br>\n");
            const text = postInfo.body.text.split("\n").map(it => `<span>${it}</span>`).join("<br>\n");
            postObject.setHtml(header + imageTags + text);
            break;
        }
        case "file": {
            const files = postInfo.body.files.map(it => postObject.addFile(it.name, it.extension, it.url));
            const fileTags = files.map(it => postObject.getFileLinkTag(it)).join("<br>\n");
            const text = postInfo.body.text.split("\n").map(it => `<span>${it}</span>`).join("<br>\n");
            postObject.setHtml(header + fileTags + text);
            break;
        }
        case "article": {
            const images = convertImageMap(postInfo.body.imageMap, postInfo.body.blocks).map(it => postObject.addFile(postName, it.extension, it.originalUrl));
            const files = convertFileMap(postInfo.body.fileMap, postInfo.body.blocks).map(it => postObject.addFile(it.name, it.extension, it.url));
            const embeds = convertEmbedMap(postInfo.body.embedMap, postInfo.body.blocks);
            let cntImg = 0, cntFile = 0, cntEmbed = 0;
            const body = postInfo.body.blocks.map(it => {
                switch (it.type) {
                    case 'p':
                        return `<span>${it.text}</span>`;
                    case 'header':
                        return `<h2><span>${it.text}</span></h2>`;
                    case 'file':
                        return postObject.getFileLinkTag(files[cntFile++]);
                    case 'image':
                        return postObject.getImageLinkTag(images[cntImg++]);
                    case "embed":
                        // FIXME 型が分からないので取りあえず文字列に投げて処理
                        return `<span>${embeds[cntEmbed++]}</span>`;
                    default:
                        return console.error(`unknown block type: ${it.type}`);
                }
            }).join("<br>\n");
            postObject.setHtml(header + body);
            break;
        }
        case "text": {// FIXME 型が分からないので適当に書いてる
            let body = '';
            if (postInfo.body.text) {
                body = postInfo.body.text.split("\n").map(it => `<span>${it}</span>`).join("<br>\n");
            } else if (postInfo.body.blocks) {
                body = postInfo.body.blocks.map(it => {
                    switch (it.type) {
                        case 'header':
                            return `<h2><span>${it.text}</span></h2>`;
                        case 'p':
                            return `<span>${it.text}</span>`;
                        default:
                            return '';
                    }
                }).join("<br>\n");
            }
            postObject.setHtml(header + body);
            break;
        }
        default:
            console.log(`不明なタイプ\n${postInfo.type}@${postInfo.id}`);
            break;
    }
    if (limit != null) limit--;
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
 * TODO switch部分を共通部分へ移す
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

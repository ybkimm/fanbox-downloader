import {DownloadHelper, DownloadObject, DownloadUtils} from 'download-helper/download-helper';

/**
 * ダウンローダーの管理クラス
 */
class DownloadManage {
    /** ダウンロード用ユーティリティ 何かあれば適当にオーバライドする */
    public static readonly utils = new DownloadUtils();

    /** 投稿の情報を個別に取得しない（基本true, 取得する場合はfalseに変える）*/
    public readonly isEco = true;

    public readonly downloadObject: DownloadObject;
    public isIgnoreFree = false;
    private readonly tags: string[];
    private isLimitAvailable = false;
    private limit: number = 0;

    constructor(
        public readonly userId: string,
        public readonly feeMap: Map<number, string>,
        initTags: string[]
    ) {
        this.tags = feeMap.get(0) == undefined ? ["無料プラン", ...initTags] : [...initTags];
        this.downloadObject = new DownloadObject(userId, DownloadManage.utils);
    }

    getTags(): string[] {
        return this.tags;
    }

    getTagByFee(fee: number): string {
        return this.feeMap.get(fee) ?? (fee > 0 ? `${fee}円` : "無料") + "プラン";
    }

    setLimitAvailable(isLimitAvailable: boolean) {
        this.isLimitAvailable = isLimitAvailable;
    }

    isLimitValid(): boolean {
        if (!this.isLimitAvailable) return true;
        return this.limit > 0;
    }

    decrementLimit() {
        if (this.isLimitAvailable) {
            this.limit--;
        }
    }

    setLimit(limit: number) {
        if (this.isLimitAvailable) {
            this.limit = limit;
        }
    }
}

/**
 * メイン
 */
export async function main() {
    let downloadObject: DownloadObject | undefined;
    if (window.location.origin === "https://downloads.fanbox.cc") {
        await new DownloadHelper(DownloadManage.utils).createDownloadUI('fanbox-downloader');
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
    const jsonCopied = () => {
        alert("jsonをコピーしました。downloads.fanbox.ccで実行して貼り付けてね");
        if (confirm("downloads.fanbox.ccに遷移する？")) {
            document.location.href = "https://downloads.fanbox.cc";
        }
    };
    try {
        await navigator.clipboard.writeText(json);
        jsonCopied();
    } catch (_) {
        document.body.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(json);
                jsonCopied();
            } catch (_) {
                alert("jsonコピーに失敗しました。もう一度実行するかコンソールからコピーしてね");
            }
        }, {once: true});
        alert("jsonコピーに失敗しました。画面の適当なとこをクリック！");
    }
}

/**
 * 投稿情報を取得して userId に入れる
 * @param userId ユーザーID
 * @param postId 投稿ID
 */
async function searchBy(userId: string | undefined, postId: string | undefined): Promise<DownloadObject | undefined> {
    if (!userId) {
        alert("しらないURL");
        return;
    }
    const plans = DownloadManage.utils.httpGetAs<Plans>(`https://api.fanbox.cc/plan.listCreator?creatorId=${userId}`).body;
    const feeMapper = new Map<number, string>();
    plans?.forEach(plan => feeMapper.set(plan.fee, plan.title));
    const definedTags = DownloadManage.utils.httpGetAs<Tags>(`https://api.fanbox.cc/tag.getFeatured?creatorId=${userId}`)
        .body?.map(tag => tag.tag) ?? [];
    const planTags = plans?.map(plan => plan.title) ?? []
    const tags = [...planTags, ...definedTags];
    const downloadSettings = new DownloadManage(userId, feeMapper, tags);
    downloadSettings.downloadObject.setUrl(`https://www.fanbox.cc/@${userId}`);
    if (postId) addByPostInfo(downloadSettings, getPostInfoById(postId));
    else await getItemsById(downloadSettings);
    downloadSettings.downloadObject.setTags(downloadSettings.getTags());
    return downloadSettings.downloadObject;
}

/**
 * ユーザーIDからitemsを得る
 * @param downloadManage ダウンロード設定
 */
async function getItemsById(downloadManage: DownloadManage) {
    downloadManage.isIgnoreFree = confirm("無料コンテンツを省く？");
    const limitBase = prompt("取得制限数を入力 キャンセルで全て取得");
    if (limitBase) {
        const limit = Number.parseInt(limitBase);
        if (limit) {
            downloadManage.setLimitAvailable(true);
            downloadManage.setLimit(limit);
        }
    }
    let nextUrl: string | null = `https://api.fanbox.cc/post.listCreator?creatorId=${downloadManage.userId}&limit=100`;
    for (let count = 1; nextUrl; count++) {
        console.log(count + "回目");
        nextUrl = addByPostListUrl(downloadManage, nextUrl);
        await DownloadManage.utils.sleep(100);
    }
}

/**
 * 投稿リストURLからURLリストに追加
 * @param downloadManage ダウンロード設定
 * @param url
 */
function addByPostListUrl(downloadManage: DownloadManage, url: string): string | null {
    const postList = DownloadManage.utils.httpGetAs<{ body: { items: PostInfo[], nextUrl: string | null } }>(url);
    const items = postList.body.items;

    console.log("投稿の数:" + items.length);
    for (let i = 0; i < items.length && downloadManage.isLimitValid(); i++) {
        if (downloadManage.isEco) {
            console.log(items[i]);
            addByPostInfo(downloadManage, items[i]);
        } else {
            addByPostInfo(downloadManage, getPostInfoById(items[i].id));
        }
    }
    return postList.body.nextUrl;
}

/**
 * 投稿IDからpostInfoを得る
 * @param postId 投稿ID
 */
function getPostInfoById(postId: string): PostInfo | undefined {
    return DownloadManage.utils.httpGetAs<{ body?: PostInfo }>(`https://api.fanbox.cc/post.info?postId=${postId}`).body;
}

/**
 * postInfoオブジェクトからURLリストに追加する
 * @param downloadManage ダウンロード設定
 * @param postInfo 投稿情報オブジェクト
 */
function addByPostInfo(downloadManage: DownloadManage, postInfo: PostInfo | undefined) {
    if (!postInfo || (downloadManage.isIgnoreFree && (postInfo.feeRequired === 0))) {
        return;
    }
    if (!postInfo.body) {
        console.log(`取得できませんでした(支援がたりない？)\nfeeRequired: ${postInfo.feeRequired}@${postInfo.id}`);
        return;
    }
    const postName = postInfo.title;
    const postObject = downloadManage.downloadObject.addPost(postName);
    postObject.setTags([downloadManage.getTagByFee(postInfo.feeRequired), ...postInfo.tags]);
    const header: string = ((url: string | null) => {
        if (url) {
            const ext = url.split('.').pop() ?? "";
            return `${postObject.getImageLinkTag(postObject.setCover("cover", ext, url))}<h5>${postName}</h5>\n`
        }
        return `<h5>${postName}</h5>\n<br>\n`;
    })(postInfo.coverImageUrl);
    const informationTextBase = `id: ${postInfo.id}\ntitle: ${postInfo.title}\nfee: ${postInfo.feeRequired}\n` +
        `publishedDatetime: ${postInfo.publishedDatetime}\nupdatedDatetime: ${postInfo.updatedDatetime}\n` +
        `tags: ${postInfo.tags.join(', ')}\nexcerpt:\n${postInfo.excerpt}\ntxt:\n`;
    let informationText: string;

    switch (postInfo.type) {
        case "image": {
            const images = postInfo.body.images.map(it => postObject.addFile(postName, it.extension, it.originalUrl));
            const imageTags = images.map(it => postObject.getImageLinkTag(it)).join("<br>\n");
            const text = postInfo.body.text.split("\n").map(it => `<span>${it}</span>`).join("<br>\n");
            postObject.setHtml(header + imageTags + "<br>\n" + text);
            informationText = `${postInfo.body.text}\n`;
            break;
        }
        case "file": {
            const files = postInfo.body.files.map(it => postObject.addFile(it.name, it.extension, it.url));
            const fileTags = files.map(it => postObject.getAutoAssignedLinkTag(it)).join("<br>\n");
            const text = postInfo.body.text.split("\n").map(it => `<span>${it}</span>`).join("<br>\n");
            postObject.setHtml(header + fileTags + "<br>\n" + text);
            informationText = `${postInfo.body.text}\n`;
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
                        return postObject.getAutoAssignedLinkTag(files[cntFile++]);
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
            informationText = postInfo.body.blocks
                .filter((it): it is TextBlock => it.type === "p" || it.type === "header")
                .map(it => it.text)
                .join("\n") + '\n';
            break;
        }
        case "text": {// FIXME 型が分からないので適当に書いてる
            let body = '';
            if (postInfo.body.text) {
                body = postInfo.body.text.split("\n").map(it => `<span>${it}</span>`).join("<br>\n");
                informationText = postInfo.body.text;
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
                informationText = postInfo.body.blocks
                    .map(it => it.type == 'header' || it.type == 'p' ? it.text : '')
                    .join("\n") + '\n';
            } else informationText = 'undefined text type\n';
            postObject.setHtml(header + body);
            break;
        }
        default:
            informationText = `不明なタイプ\n${postInfo.type}@${postInfo.id}\n`;
            console.log(`不明なタイプ\n${postInfo.type}@${postInfo.id}`);
            break;
    }
    postObject.setInfo(informationTextBase + informationText);
    downloadManage.decrementLimit();
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

type Plans = {
    body?: {
        id: string,
        title: string,
        fee: number,
        description: string,
        coverImageUrl: string,
    }[]
};
type Tags = {
    body?: {
        tag: string,
        count: number,
        coverImageUrl: string,
    }[]
};
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
    body: { text: string, files: FileInfo[] },
} | {
    type: "article",
    body: { imageMap: Record<string, ImageInfo>, fileMap: Record<string, FileInfo>, embedMap: Record<string, EmbedInfo>, blocks: Block[] },
    // TODO embedMap, urlEmbedMapの対応
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

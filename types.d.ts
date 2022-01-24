/**
 * プランAPIの型
 * @see https://api.fanbox.cc/plan.listCreator?creatorId=${creatorId}
 */
type Plans = {
    body?: {
        id: string,
        title: string,
        fee: number,
        description: string,
        coverImageUrl: string,
    }[]
};

/**
 * タグAPIの型
 * @see https://api.fanbox.cc/tag.getFeatured?creatorId=${creatorId}
 */
type Tags = {
    body?: {
        tag: string,
        count: number,
        coverImageUrl: string,
    }[]
};


/**
 * 投稿情報の型
 * @see https://api.fanbox.cc/post.listCreator?creatorId=${creatorId}
 * @see https://api.fanbox.cc/post.info?postId=${postId}
 */
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
    body: {
        imageMap: Record<string, ImageInfo>,
        fileMap: Record<string, FileInfo>,
        embedMap: Record<string, EmbedInfo>,
        blocks: Block[]
    },
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

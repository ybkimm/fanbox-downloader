const path = require('path');

module.exports = {
    mode: "production",
    entry: './fanbox-downloader.ts',
    output: {
        filename: 'fanbox-downloader.min.js',
        path: path.resolve(__dirname, 'docs'),
        library: {
            type: 'module',
        },
    },
    module: {
        rules: [{
            test: /\.ts$/,
            use: 'ts-loader'
        }]
    },
    resolve: {
        extensions: ['.ts', '.js']
    },
    experiments: {
        outputModule: true,
    },
}

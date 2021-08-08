const path = require('path');

module.exports = {
    mode: "production",
    entry: './fanbox-downloader.ts',
    output: {
        filename: 'fanbox.js',
        path: path.resolve(__dirname, 'docs'),
        library: 'main',
        libraryTarget: 'window',
        libraryExport: 'main'
    },
    module: {
        rules: [{
            test: /\.ts$/,
            use: 'ts-loader'
        }]
    },
    resolve: {
        extensions: ['.ts', '.js']
    }
}

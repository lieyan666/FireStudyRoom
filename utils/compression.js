const { minify: minifyHtml } = require('html-minifier-terser');
const { minify: minifyJs } = require('terser');
const CleanCSS = require('clean-css');
const fs = require('fs').promises;
const path = require('path');

const cleanCss = new CleanCSS();

// HTML 压缩配置
const htmlMinifyOptions = {
    removeComments: true,
    collapseWhitespace: true,
    collapseBooleanAttributes: true,
    removeAttributeQuotes: true,
    removeEmptyAttributes: true,
    minifyJS: true,
    minifyCSS: true
};

// 压缩 HTML
async function compressHtml(content) {
    try {
        return await minifyHtml(content, htmlMinifyOptions);
    } catch (err) {
        console.error('HTML compression error:', err);
        return content;
    }
}

// 压缩 JavaScript
async function compressJs(content) {
    try {
        const result = await minifyJs(content);
        return result.code;
    } catch (err) {
        console.error('JavaScript compression error:', err);
        return content;
    }
}

// 压缩 CSS
function compressCss(content) {
    try {
        return cleanCss.minify(content).styles;
    } catch (err) {
        console.error('CSS compression error:', err);
        return content;
    }
}

// 压缩中间件
function compressionMiddleware(rootDir) {
    return async function(req, res, next) {
        // 仅在生产环境中启用压缩
        if (process.env.NODE_ENV !== 'production') {
            return next();
        }

        const originalSend = res.send;
        const originalSendFile = res.sendFile;

        // 重写 send 方法
        res.send = async function(data) {
            let content = data;
            const contentType = res.get('Content-Type');

            if (typeof content !== 'string') {
                return originalSend.call(this, content);
            }

            if (contentType?.includes('text/html')) {
                content = await compressHtml(content);
            } else if (contentType?.includes('application/javascript')) {
                content = await compressJs(content);
            } else if (contentType?.includes('text/css')) {
                content = compressCss(content);
            }

            return originalSend.call(this, content);
        };

        // 重写 sendFile 方法
        res.sendFile = async function(filePath, options, callback) {
            try {
                const ext = path.extname(filePath);
                const content = await fs.readFile(filePath, 'utf8');
                
                let compressedContent;
                if (ext === '.html') {
                    compressedContent = await compressHtml(content);
                    res.set('Content-Type', 'text/html');
                } else if (ext === '.js') {
                    compressedContent = await compressJs(content);
                    res.set('Content-Type', 'application/javascript');
                } else if (ext === '.css') {
                    compressedContent = compressCss(content);
                    res.set('Content-Type', 'text/css');
                } else {
                    return originalSendFile.call(this, filePath, options, callback);
                }

                return res.send(compressedContent);
            } catch (err) {
                if (callback) {
                    callback(err);
                } else {
                    next(err);
                }
            }
        };

        next();
    };
}

module.exports = compressionMiddleware;
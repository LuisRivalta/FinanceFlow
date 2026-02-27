const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (!fullPath.includes('node_modules') && !fullPath.includes('.next')) {
                results = results.concat(walk(fullPath));
            }
        } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js') || fullPath.endsWith('.css')) {
            results.push(fullPath);
        }
    });
    return results;
}

const files = walk('c:/finance-next/src');
let changedCount = 0;

files.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    let original = content;

    if (f.endsWith('.css')) {
        content = content.replace(/font-size:\s*(\d+(\.\d+)?)px/g, (match, p1) => {
            return 'font-size: ' + (Number(p1) / 16) + 'rem';
        });
    } else {
        // match fontSize: 16
        content = content.replace(/fontSize:\s*(\d+(\.\d+)?)(?!rem)/g, (match, p1) => {
            return `fontSize: '${Number(p1) / 16}rem'`;
        });
        // match font-size: 16px
        content = content.replace(/font-size:\s*['"]?(\d+(\.\d+)?)px['"]?/g, (match, p1) => {
            return 'font-size: ' + (Number(p1) / 16) + 'rem';
        });
    }

    if (content !== original) {
        fs.writeFileSync(f, content, 'utf8');
        changedCount++;
    }
});
console.log('Modified ' + changedCount + ' files.');

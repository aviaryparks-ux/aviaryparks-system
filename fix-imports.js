const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('./app/(admin)', function(filePath) {
  if (filePath.endsWith('.tsx')) {
    let content = fs.readFileSync(filePath, 'utf-8');
    let original = content;

    if (content.includes('<LoadingScreen') && !content.includes('import LoadingScreen')) {
       if (content.includes('"use client";')) {
         content = content.replace('"use client";', '"use client";\nimport LoadingScreen from "@/components/ui/LoadingScreen";');
       } else {
         content = 'import LoadingScreen from "@/components/ui/LoadingScreen";\n' + content;
       }
    }
    
    if (original !== content) {
      fs.writeFileSync(filePath, content, 'utf-8');
      console.log('Fixed import in', filePath);
    }
  }
});

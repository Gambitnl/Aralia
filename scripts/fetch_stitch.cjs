const fs = require('fs');
async function run() {
    const url = "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sX2RjMGUyNTM2NzI5MzQzMTQ4ZGIxMjRjYTcxNzA1YWUzEgsSBxDnjL_01RUYAZIBJAoKcHJvamVjdF9pZBIWQhQxNDQxNjQ1NTQzMTM4MzkwMzE4Mg&filename=&opi=89354086";
    const res = await fetch(url);
    const text = await res.text();
    fs.writeFileSync('scripts/stitch_code.txt', text, 'utf8');
    console.log('Downloaded stitch_code.txt, length:', text.length);
    console.log('Status code:', res.status);
}
run();

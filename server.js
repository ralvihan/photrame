// Local dev server: node server.js  ->  http://127.0.0.1:5500
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=__dirname,PORT=5500;
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.webp':'image/webp','.woff2':'font/woff2'};
http.createServer((req,res)=>{
  let p=decodeURIComponent(req.url.split('?')[0]);
  let file=path.join(ROOT,p==='/'?'index.html':p);
  if(!file.startsWith(ROOT)){res.writeHead(403);return res.end()}
  fs.stat(file,(err,st)=>{
    if(err||!st.isFile()){
      if(path.extname(p)){res.writeHead(404);return res.end('Not found')}
      file=path.join(ROOT,'index.html');
    }
    res.writeHead(200,{'Content-Type':MIME[path.extname(file)]||'application/octet-stream'});
    fs.createReadStream(file).pipe(res);
  });
}).listen(PORT,'127.0.0.1',()=>console.log('http://127.0.0.1:'+PORT));
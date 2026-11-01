import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(fileURLToPath(new URL('../dist/',import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const port=Number(process.env.PORT||5173);
const server=http.createServer(async(req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'}).end();return;}
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=path.resolve(root,pathname==='/'?'index.html':'.'+pathname);
    if(!file.startsWith(root+path.sep)&&file!==path.join(root,'index.html')){res.writeHead(403).end('Forbidden');return;}
    const bytes=await readFile(file);
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});
    res.end(req.method==='HEAD'?undefined:bytes);
  }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'}).end('Not found');}
});
server.on('error',err=>{console.error(`Cannot start development server: ${err.message}`);process.exitCode=1;});
// PORT=0 picks a free port; the line below prints the one actually used.
server.listen(port,'127.0.0.1',()=>console.log(`Kinetic lab: http://127.0.0.1:${server.address().port}`));

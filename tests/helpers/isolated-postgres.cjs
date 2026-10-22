// Protocolo PostgreSQL real sobre PGlite em memória, sem ler .env.
const net=require('node:net'),postgres=require('postgres')
exports.isolatedPostgres=async(p,queries=[])=>{
 await p.waitReady
 const sockets=new Set()
 const server=net.createServer(socket=>{
  sockets.add(socket)
  let pending=Buffer.alloc(0),started=false
  socket.on('close',()=>sockets.delete(socket));socket.on('error',()=>{})
  socket.on('data',chunk=>{
   pending=Buffer.concat([pending,chunk])
   while(pending.length>=(started?5:4)) {
    const size=started?pending.readUInt32BE(1)+1:pending.readUInt32BE(0)
    if(pending.length<size)return
    const packet=pending.subarray(0,size)
    pending=pending.subarray(size);started=true
    if(packet[0]===88){socket.end();return}
    try {const reply=p.execProtocolRawSync(packet);if(reply.length)socket.write(reply)}
    catch(error){socket.destroy(error);return}
   }
  })
 })
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
 const sql=postgres({host:'127.0.0.1',port:server.address().port,database:'postgres',username:'postgres',ssl:false,max:1,
  debug:(_connection,query)=>queries.push(query),onnotice:()=>{}})
 return {sql,close:async()=>{
  await sql.end({timeout:1});for(const socket of sockets)socket.destroy()
  await new Promise(resolve=>server.close(resolve))
 }}
}

export default async function handler(req,res){

try{

const payload=req.body;

const decoded=Buffer.from(payload,"base64").toString();

res.json({data:decoded});

}catch{

res.status(400).send("error");

}

}

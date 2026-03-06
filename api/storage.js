let store={};

export default function handler(req,res){

const {key,value}=req.body||{};

if(req.method==="POST"){

store[key]=value;

res.json({ok:true});

}

if(req.method==="GET"){

res.json({value:store[key]});

}

}

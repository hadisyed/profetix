import express from 'express';
import Stripe from 'stripe';
import {createReadStream,existsSync} from 'node:fs';
import {resolve} from 'node:path';
const app=express();
const stripe=new Stripe(process.env.STRIPE_SECRET_KEY||'sk_test_unconfigured');
const required=['STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','STRIPE_STARTER_PAYMENT_LINK_ID','STRIPE_AUTOMATION_PAYMENT_LINK_ID','PUBLIC_BASE_URL','RESEND_API_KEY','DELIVERY_FROM_EMAIL'];
const configured=()=>required.every(k=>process.env[k]&&!/REPLACE_ME|YOUR-/.test(process.env[k]));
const products=()=>({
 [process.env.STRIPE_STARTER_PAYMENT_LINK_ID]:{name:'AI Business Starter Kit',file:'starter-kit.zip'},
 [process.env.STRIPE_AUTOMATION_PAYMENT_LINK_ID]:{name:'AI Automation Toolkit',file:'automation-toolkit.zip'}
});
const getProduct=s=>products()[s.payment_link];
const paid=s=>s.payment_status==='paid'&&s.mode==='payment'&&getProduct(s);
app.post('/api/stripe-webhook',express.raw({type:'application/json'}),async(req,res)=>{
 if(!configured())return res.status(503).send('Not configured');
 let event;
 try{event=stripe.webhooks.constructEvent(req.body,req.headers['stripe-signature'],process.env.STRIPE_WEBHOOK_SECRET)}
 catch{return res.status(400).send('Invalid signature')}
 if(!['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type))return res.json({received:true});
 try{
  const session=await stripe.checkout.sessions.retrieve(event.data.object.id);
  if(!paid(session))return res.json({received:true,fulfilled:false});
  const recipient=session.customer_details?.email||session.customer_email;
  if(!recipient)throw Error('Missing buyer email');
  const url=process.env.PUBLIC_BASE_URL+'/api/download?session_id='+encodeURIComponent(session.id);
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'profetix-'+session.id},body:JSON.stringify({from:process.env.DELIVERY_FROM_EMAIL,to:[recipient],subject:'Your Profetix '+getProduct(session).name,text:'Your download link (valid 7 days): '+url+'\nSupport: hello@profetix.com'})});
  if(!response.ok)throw Error('Email service returned '+response.status);
  return res.json({received:true,fulfilled:true});
 }catch(e){console.error(e.message);return res.status(500).send('Retry fulfillment')}
});
app.get('/api/download',async(req,res)=>{
 if(!configured())return res.status(503).send('Not configured');
 const id=String(req.query.session_id||'');
 if(!/^cs_(test_)?[A-Za-z0-9]+$/.test(id))return res.status(400).send('Invalid link');
 try{
  const session=await stripe.checkout.sessions.retrieve(id);
  if(!paid(session))return res.status(403).send('Payment not verified');
  if(Date.now()-session.created*1000>7*86400000)return res.status(410).send('Expired; contact support');
  const product=getProduct(session),file=resolve('private',product.file);
  if(!existsSync(file))return res.status(503).send('Package not yet available; contact support');
  res.set({'Cache-Control':'private, no-store','Content-Type':'application/zip','Content-Disposition':'attachment; filename="'+product.file+'"'});
  createReadStream(file).pipe(res);
 }catch(e){console.error(e.message);return res.status(503).send('Unable to verify payment')}
});
app.get('/health',(_req,res)=>res.json({service:'profetix-delivery',configured:configured()}));
app.listen(Number(process.env.PORT)||3000);

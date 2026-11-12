export async function generateWithOneRetry<T>(generate:()=>Promise<T>,reserveRetry:()=>Promise<boolean>,pause:(ms:number)=>Promise<void>=ms=>new Promise(resolve=>setTimeout(resolve,ms))):Promise<T>{
 try{return await generate();}catch(error){
  const status=Number((error as {status?:number})?.status||0);
  // Quota, validation and safety failures must not consume another attempt.
  if(![500,502,503,504].includes(status)||!await reserveRetry())throw error;
  await pause(1500);
  return generate();
 }
}

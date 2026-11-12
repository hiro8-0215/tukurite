export function settlementKey(period:string,author:string){return period+':'+author;}
export const reservedPoolSql=`INSERT INTO transfers(id,payer_user,payer,recipient,author,period,amount,kind,settlement_key,status,created)
 SELECT ?,?,?,?,?,?,?,?,?,'pending',?
 WHERE (SELECT COALESCE(SUM(amount),0) FROM transfers WHERE period=? AND kind='reward' AND status IN ('pending','confirmed'))+?<=?`;

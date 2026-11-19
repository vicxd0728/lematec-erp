"""Read shared Excel; import only accounting review snapshots, never inventory.
Dry-run default. --apply requires NOTION_TOKEN and deployed ledger schema/API.
"""
import argparse,hashlib,io,json,math,os,sys
from pathlib import Path
from collections import Counter
import openpyxl,requests

WORKER='https://green-wave-c22f.vic-e93.workers.dev'
def parse_book(data):
 if not data.startswith(b'PK'):raise ValueError('非一般 XLSX；檔案可能加密。停止解析，請提供解密副本。')
 book=openpyxl.load_workbook(io.BytesIO(data),read_only=True,data_only=True,keep_links=False)
 try:
  sheet=book['仂邁1'];months={9:[],10:[]};excluded=[]
  for line,row in enumerate(sheet.iter_rows(values_only=True),1):
   if line==1 or row[0] not in months:continue
   _,supplier,label,qty,price,amount,*_=row
   if not isinstance(label,str) or not label.strip():continue
   if isinstance(qty,bool) or not isinstance(qty,(int,float)) or not math.isfinite(qty):
    excluded.append({'line':line,'month':row[0],'reason':'沒有數值數量，非本階段品項列','label':label});continue
   if not supplier or not str(supplier).strip():raise ValueError(f'第 {line} 列缺少廠商，停止匯入而非猜測群組')
   def numeric(value):
    if value is None:return None
    if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value):raise ValueError(f'第 {line} 列金額格式需確認')
    return value
   months[row[0]].append({'line':line,'supplier':str(supplier).strip(),'label':label.strip(),'quantity':qty,'unit_price':numeric(price),'amount':numeric(amount)})
  return sheet.title,months,excluded
 finally:book.close()

def main():
 sys.stdout.reconfigure(encoding='utf-8')
 p=argparse.ArgumentParser();p.add_argument('--file',default=r'\\Lematec-pc\共用\115進貨明細表.xlsx');p.add_argument('--out',default='output/purchase-ledger-20261119');p.add_argument('--apply',action='store_true');args=p.parse_args()
 out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
 raw=Path(args.file).read_bytes();digest=hashlib.sha256(raw).hexdigest();sheet,months,excluded=parse_book(raw)
 batches=[{'source_key':'115進貨明細表.xlsx','source_hash':digest,'period':f'2026-{m:02}','payload':{'sheet':sheet,'rows':rows}} for m,rows in months.items()]
 for b in batches:(out/(b['period']+'.json')).write_text(json.dumps(b,ensure_ascii=False,indent=2),encoding='utf8')
 summary={'source_sha256':digest,'months':{b['period']:{'rows':len(b['payload']['rows']),'distinct_supplier_labels':len({(x['supplier'],x['label']) for x in b['payload']['rows']})} for b in batches},'excluded':excluded,'inventory_write_requests':0}
 (out/'source-report.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf8')
 if args.apply:
  headers={'Authorization':'Bearer '+os.environ['NOTION_TOKEN'],'X-ERP-Role':'vic'};receipts=[]
  for b in batches:
   response=requests.post(WORKER+'/api/purchase-ledger/import',json=b,headers=headers,timeout=60)
   response.raise_for_status();receipt=response.json();assert receipt.get('ok');receipts.append(receipt)
   fresh=requests.get(WORKER+'/api/purchase-ledger/list',params={'period':b['period']},headers=headers,timeout=60)
   fresh.raise_for_status();batch=fresh.json()['batch'];assert batch['source_hash']==digest and batch['payload']==b['payload']
   (out/(b['period']+'-receipt.json')).write_text(json.dumps(receipt,indent=2),encoding='utf8')
  summary['apply_readback']=receipts
  (out/'import-complete.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf8')
 print(json.dumps(summary,ensure_ascii=False))
if __name__=='__main__':main()

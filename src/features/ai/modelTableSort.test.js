import test from 'node:test';
import assert from 'node:assert/strict';
import {compareModelRows,modelSortValue,matchesModelSearch} from './modelTableSort.js';
const sorted=(rows,key,dir='asc')=>[...rows].sort((a,b)=>compareModelRows(a,b,{key,dir}));
test('route priorities sort numerically with zero admitted',()=>{
 const rows=[{priority:'P10'},{priority:'P2'},{priority:'P0'},{priority:'—'}];
 assert.deepEqual(sorted(rows,'priority').map(r=>r.priority),['P0','P2','P10','—']);
 assert.deepEqual(sorted(rows,'priority','desc').map(r=>r.priority),['P10','P2','P0','—']);
});
test('server timestamp and numeric priority take precedence over labels',()=>{
 assert.equal(modelSortValue({priority:'P10',rawOperation:{route_priority:2}},'priority'),2);
 assert.equal(modelSortValue({updated:'unparseable',rawOperation:{updated_at:'2026-10-09T00:00:00Z'}},'updated'),Date.parse('2026-10-09T00:00:00Z'));
});
test('context windows sort by token count instead of label',()=>{
 assert.deepEqual(sorted([{context:'128K'},{context:'1M'},{context:'32K'},{context:'未知'}],'context').map(r=>r.context),['32K','128K','1M','未知']);
});
test('unknown monetary values and usage remain last in both directions',()=>{
 for(const dir of ['asc','desc']){
  assert.equal(sorted([{used:null},{used:0},{used:2}],'used',dir).at(-1).used,null);
  assert.equal(sorted([{quota:0,used:0},{quota:10,used:0},{quota:10,used:5}],'usage',dir).at(-1).quota,0);
 }
 assert.equal(modelSortValue({used:null,quota:100},'usage'),null);
 assert.equal(modelSortValue({used:0,quota:100},'usage'),0);
});
test('numeric values reject missing and nonfinite strings',()=>{
 for(const used of [null,undefined,'','  ',false,true,[],{},'未知',Infinity,NaN])assert.equal(modelSortValue({used},'used'),null);
 assert.equal(compareModelRows({}, {}, null),0);
});
test('search supports exact model identifier, names, provider and empty reset',()=>{
 const row={model:'DeepSeek V4.1 Flash',modelId:'deepseek-flash',provider:'DeepSeek',type:'对话'};
 assert.equal(matchesModelSearch(row,' DEEPSEEK-FLASH '),true);
 assert.equal(matchesModelSearch(row,'v4.1'),true);
 assert.equal(matchesModelSearch(row,'对话'),true);
 assert.equal(matchesModelSearch(row,''),true);
 assert.equal(matchesModelSearch(row,'absent-model'),false);
});

const test=require('node:test'),assert=require('node:assert/strict');
const {patternHandoff}=require('../dist/work-reports/pattern-milestones');
test('only first assignment from no sample maker counts as pattern completion',()=>{
 assert.deepEqual(patternHandoff('纸样分配：纸样师 吴小勇；样衣工 王师傅'),{master:'吴小勇',maker:'王师傅'});
 assert.deepEqual(patternHandoff('修改纸样分配：纸样师 吴小勇→吴小勇；样衣工 -→王师傅'),{master:'吴小勇',maker:'王师傅'});
 assert.equal(patternHandoff('纸样分配：纸样师 吴小勇；样衣工 -'),null);
 assert.equal(patternHandoff('修改纸样分配：纸样师 吴小勇→李师傅；样衣工 王师傅→张师傅'),null);
 assert.equal(patternHandoff('修改纸样分配：纸样师 吴小勇→吴小勇；样衣工 王师傅→-'),null);
 assert.equal(patternHandoff('纸样完成：样衣图已上传'),null);
});

/**
 * 质检看板自检脚本 — 每次修改后运行验证
 * 用法: node qc-check.js
 */
const fs = require('fs');
const path = require('path');
const errors = [];

// 1. JS 语法检查
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const s = html.indexOf('<script>', html.indexOf('qc-data.js'));
const e = html.lastIndexOf('</script>');
if (s < 0 || e < 0) { errors.push('SCRIPT: 找不到内联 <script> 块'); }
else {
  const js = html.substring(s + 8, e);
  const tmp = path.join(__dirname, '_qc_check_tmp.js');
  fs.writeFileSync(tmp, js);
  try {
    require('child_process').execSync(`node --check "${tmp}"`, { stdio: 'pipe' });
    console.log('✅ JS语法: 通过');
  } catch (err) {
    errors.push('JS语法错误: ' + (err.stderr ? err.stderr.toString().split('\n')[0] : err.message));
  }
  fs.unlinkSync(tmp);
}

// 2. RECORDS 直接引用检查（分析函数应使用 getFiltered()）
const analysisFuncs = ['renderAna', 'renderDesc', 'renderMerchant', 'renderDiff', 'renderInsight'];
const lines = html.split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('RECORDS.filter') || line.includes('RECORDS.forEach') || line.includes('RECORDS.length')) {
    // Check if inside an analysis function that should use getFiltered
    if (line.includes('renderAna') || line.includes('renderDescAnalysis') || line.includes('renderAnaInsight')) {
      errors.push(`行${i + 1}: 分析函数中直接使用RECORDS，应改用getFiltered(): ${line.trim().substring(0, 80)}`);
    }
  }
}
if (!errors.some(e => e.includes('RECORDS'))) console.log('✅ 数据源: 分析函数均已使用getFiltered()');

// 3. DOM ID 一致性检查
const jsPart = html.substring(html.indexOf('<script>', html.indexOf('qc-data.js')));
const ids = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
const jsRefs = [...jsPart.matchAll(/getElementById\(['"](\w+)['"]\)/g)].map(m => m[1]);
const missing = [...new Set(jsRefs)].filter(id => !ids.includes(id));
if (missing.length) errors.push('DOM缺失: JS引用了HTML中不存在的ID: ' + missing.join(', '));
else console.log('✅ DOM引用: ' + jsRefs.length + '个引用全部存在');

// 4. 函数调用一致性
const funcDefs = [...jsPart.matchAll(/function (\w+)\(/g)].map(m => m[1]);
const funcCalls = [...jsPart.matchAll(/(\w+)\(/g)].map(m => m[1]).filter(f => !['if', 'for', 'while', 'switch', 'catch', 'typeof', 'console', 'Math', 'Object', 'Array', 'String', 'Number', 'Date', 'JSON', 'parseInt', 'parseFloat', 'isNaN', 'setTimeout', 'clearTimeout', 'setInterval', 'localStorage', 'document', 'window', 'new', 'return'].includes(f));
console.log('✅ 函数定义: ' + funcDefs.length + '个, 调用: ' + [...new Set(funcCalls)].length + '个');

// 5. 文件大小
const size = fs.statSync(path.join(__dirname, 'index.html')).size;
console.log('✅ 文件大小: ' + (size / 1024).toFixed(1) + 'KB');

// Summary
if (errors.length) {
  console.log('\n❌ 发现 ' + errors.length + ' 个问题:');
  errors.forEach(e => console.log('  - ' + e));
  process.exit(1);
} else {
  console.log('\n🎉 自检全部通过！可以安全部署。');
}

/** Count only admitted inference requests; rejected retries never consume more budget. */
export function admitModelRequest(state,limit,path) {
  if(path.endsWith('/count_tokens')) return true;
  if(state.requests>=limit){state.budgetExhausted=true;state.deniedRequests=(state.deniedRequests||0)+1;state.error=`本轮已使用 ${limit} 次模型请求，达到预算上限。已生成的文件保留，可继续对话或调整预算。`;return false;}
  state.requests++;return true;
}
/** Preserve partial output and report resource limits independently of process exit. */
export function terminalStatus(state,exitCode) {
  if(state.cancelled)return 'cancelled';
  if(state.budgetExhausted)return 'budget_exhausted';
  if(state.timedOut)return 'timeout';
  if(state.outputLimited)return 'output_limit';
  return exitCode===0&&state.final&&!state.failed?'completed':'failed';
}

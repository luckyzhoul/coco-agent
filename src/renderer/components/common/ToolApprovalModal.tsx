import { useApprovalStore } from '../../stores/useApprovalStore';
import { useAgentEvent } from '../../hooks/useIpcRenderer';
import type { ToolApprovalRequest } from '@shared/types';

export function ToolApprovalModal() {
  const pendingRequests = useApprovalStore((s) => s.pendingRequests);
  const addRequest = useApprovalStore((s) => s.addRequest);
  const respond = useApprovalStore((s) => s.respond);

  useAgentEvent('toolApprovalRequest', (request: ToolApprovalRequest) => {
    addRequest(request);
  });

  const currentRequest = pendingRequests[0];

  if (!currentRequest) return null;

  const handleApprove = () => {
    respond(currentRequest.id, 'approve');
  };

  const handleApproveAll = () => {
    respond(currentRequest.id, 'approve_all');
  };

  const handleDeny = () => {
    respond(currentRequest.id, 'deny');
  };

  const formatInput = (input: Record<string, unknown>): string => {
    try {
      return JSON.stringify(input, null, 2);
    } catch {
      return String(input);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-chat-assistant border border-border/60 rounded-2xl w-[500px] max-h-[80vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className={`h-2.5 w-2.5 rounded-full ${
              currentRequest.isDangerous ? 'bg-destructive' : 'bg-amber-500'
            }`} />
            <h3 className="text-[15px] font-medium">
              {currentRequest.isDangerous ? '危险工具调用请求' : '工具调用请求'}
            </h3>
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {currentRequest.description}
          </p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                工具名称
              </label>
              <div className="rounded-md border border-border bg-background/70 px-3 py-2 font-mono text-[13px]">
                {currentRequest.toolName}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                调用参数
              </label>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-background/70 px-3 py-2 font-mono text-[11.5px]">
                {formatInput(currentRequest.toolInput)}
              </pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/50 flex gap-2 justify-end">
          <button
            onClick={handleDeny}
            className="rounded-md border border-input px-4 py-2 text-[13px] transition-colors hover:bg-accent"
          >
            拒绝
          </button>
          <button
            onClick={handleApprove}
            className="rounded-md border border-input px-4 py-2 text-[13px] transition-colors hover:bg-accent"
          >
            允许
          </button>
          <button
            onClick={handleApproveAll}
            className="rounded-md bg-primary px-4 py-2 text-[13px] text-primary-foreground transition-opacity hover:opacity-90"
          >
            始终允许此工具
          </button>
        </div>

        {/* Counter */}
        {pendingRequests.length > 1 && (
          <div className="pb-3 text-center text-xs text-muted-foreground">
            还有 {pendingRequests.length - 1} 个待处理
          </div>
        )}
      </div>
    </div>
  );
}

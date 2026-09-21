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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-lg w-[500px] max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${
              currentRequest.isDangerous ? 'bg-red-500' : 'bg-yellow-500'
            }`} />
            <h3 className="text-base font-semibold">
              {currentRequest.isDangerous ? 'Dangerous Tool Request' : 'Tool Request'}
            </h3>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {currentRequest.description}
          </p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Tool Name
              </label>
              <div className="font-mono text-sm bg-background rounded-md px-3 py-2 border border-border">
                {currentRequest.toolName}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Parameters
              </label>
              <pre className="text-xs bg-background rounded-md px-3 py-2 border border-border max-h-64 overflow-auto font-mono whitespace-pre-wrap">
                {formatInput(currentRequest.toolInput)}
              </pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex gap-2 justify-end">
          <button
            onClick={handleDeny}
            className="px-4 py-2 rounded-md text-sm border border-input hover:bg-accent transition-colors"
          >
            Deny
          </button>
          <button
            onClick={handleApprove}
            className="px-4 py-2 rounded-md text-sm border border-input hover:bg-accent transition-colors"
          >
            Approve
          </button>
          <button
            onClick={handleApproveAll}
            className="px-4 py-2 rounded-md text-sm bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Always Allow This Tool
          </button>
        </div>

        {/* Counter */}
        {pendingRequests.length > 1 && (
          <div className="text-xs text-muted-foreground text-center pb-3">
            {pendingRequests.length} more pending
          </div>
        )}
      </div>
    </div>
  );
}

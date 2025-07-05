// MSWで必要な BroadcastChannel のポリフィル
if (!globalThis.BroadcastChannel) {
	globalThis.BroadcastChannel = class BroadcastChannel {
		name: string;
		onmessage: ((event: MessageEvent) => void) | null = null;
		onmessageerror: ((event: MessageEvent) => void) | null = null;

		constructor(name: string) {
			this.name = name;
		}

		postMessage(_message: any): void {
			// CloudflareのWorkers環境では実装しない
		}

		close(): void {
			// CloudflareのWorkers環境では実装しない
		}

		addEventListener(_type: string, _listener: EventListener): void {
			// CloudflareのWorkers環境では実装しない
		}

		removeEventListener(_type: string, _listener: EventListener): void {
			// CloudflareのWorkers環境では実装しない
		}

		dispatchEvent(_event: Event): boolean {
			return true;
		}
	} as any;
}

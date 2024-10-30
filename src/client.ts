import { ExtWSClient } from '@extws/server';
import { WebSocket } from 'uWebSockets.js';
import { IP } from '@kirick/ip';
import { ExtWSUwsServer } from './main.js';

export class ExtWSUwsClient extends ExtWSClient {
	private uws_client: WebSocket;

	constructor(
		server: ExtWSUwsServer,
		uws_client: WebSocket,
		url: URL,
		headers: Map<string, string>,
		ip: IP,
	) {
		super(server, {
			url,
			headers,
			ip,
		});
		this.uws_client = uws_client;
	}

	addToGroup(group_id: string) {
		try {
			console.log(group_id)
			this.uws_client.subscribe(group_id);
		}
		catch (error) {
			// eslint-disable-next-line no-console
			console.error(error);
			this.disconnect();
		}
	}

	removeFromGroup(group_id: string) {
		try {
			this.uws_client.unsubscribe(group_id);
		}
		catch (error) {
			// eslint-disable-next-line no-console
			console.error(error);
			this.disconnect();
		}
	}

	sendPayload(payload: string) {
		try {
			this.uws_client.send(payload);
		}
		catch (error) {
			// eslint-disable-next-line no-console
			console.error(error);
			this.disconnect();
		}
	}

	disconnect() {
		try {
				this.uws_client.close();
		}
		catch {}

		super.disconnect();
	}
}

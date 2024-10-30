import {
	ExtWS,
	ExtWSClient,
	OutcomePayloadEventType,
} from '@extws/server';
import { App, TemplatedApp } from 'uWebSockets.js';
import { IP } from '@kirick/ip';
import { ExtWSUwsClient } from './client.js';

// TODO export from @extws/server
export const IDLE_TIMEOUT = 60;
export const GROUP_BROADCAST = 'broadcast';
export const GROUP_PREFIX = 'g-';

interface BroadcastPayload extends Event {
	payload: string;
}

interface GroupPayload extends Event {
	group_id: string;
	payload: string;
}

export class ExtWSUwsServer extends ExtWS {
	private uws_server: TemplatedApp;

	constructor({
		port,
		path = '/ws',
		payload_max_length = 1024,
	}: {
		port: number,
		path?: string,
		payload_max_length?: number,
	}) {
		super();

		this.uws_server = App();

		this.on<GroupPayload>(
			OutcomePayloadEventType.GROUP,
			(event) => {
				this.publish(
					`g-${event.group_id}`, // TODO: импортировать префикс
					event.payload,
				);
			}
		);

		this.on<BroadcastPayload>(
			OutcomePayloadEventType.BROADCAST,
			(event) => {
				this.publish(
					'broadcast', // TODO: импортировать имя группы
					event.payload,
				);
			}
		);

		this.uws_server.ws(
			path,
			{
				compression: 1,
				maxPayloadLength: payload_max_length,
				idleTimeout: IDLE_TIMEOUT,

				upgrade: (response, request, context) => {
					const headers: Map<string, string> = new Map();
					request.forEach((key, value) => {
						headers.set(key, value);
					});

					const url = new URL(
						request.getUrl() + '?' + request.getQuery(),
						'ws://' + headers.get('host'),
					);

					response.upgrade(
						{
							url,
							headers,
							id: null,
						},
						headers.get('sec-websocket-key') ?? '',
						headers.get('sec-websocket-protocol') ?? '',
						headers.get('sec-websocket-extensions') ?? '',
						context,
					);
				},
				open: (uws_client) => {
					const ip = new IP(uws_client.getRemoteAddress());
					const url = uws_client.url;
					const headers: Map<string, string> = uws_client.headers;

					const client = new ExtWSUwsClient(
						this,
						uws_client,
						url,
						headers,
						ip,
					);

					uws_client.id = client.id;
					this.onConnect(client);
				},
				message: (uws_client, payload, is_binary) => {
					const client = this.clients.get(uws_client.id);
					const payload_str = Buffer.from(payload).toString('utf8');

					if (client instanceof ExtWSClient) {
						if (!is_binary) {
							this.onMessage(
								client,
								payload_str,
							);
						}
					}
				},
				close: (uws_client) => {
					const client = this.clients.get(uws_client.id);
					if (client instanceof ExtWSClient) {
						client.disconnect();
					}
				},
			},
		);

		this.uws_server.listen(
			port,
			() => {},
		);
	}

	publish (channel: string, payload: string) {
		this.uws_server.publish(
			channel,
			payload,
		);
	}
}

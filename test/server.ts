import {
	ExtWSEvent,
	OutcomePayloadEventType,
	type ExtWSClient,
} from '@extws/server';
import { ExtWSUwsServer } from '../src/main.js';

export const extwsServer = new ExtWSUwsServer({
	port: 8080,
});

extwsServer.on<ExtWSEvent<{ name: string }>>(
	'hello',
	(event) => {
		event.client.send(
			'hello',
			{
				text: `Hello, ${event.data.name}!`,
			},
		);
	}
);

export function testBroadcast() {
	extwsServer.broadcast({
		foo: 'bar',
	});
}

export function testGroupJoin(extwsClient: ExtWSClient, name: string) {
	extwsClient.join(name);
}

export function testGroupLeave(extwsClient: ExtWSClient, name: string) {
	extwsClient.leave(name);
}

export function testSendToGroup(group_name: string) {
	extwsServer.sendToGroup(
		group_name,
		{
			foo: 'bar',
		},
	);
}

export function testSendToSocket(client_id: string) {
	extwsServer.sendToSocket(
		client_id,
		{
			foo: 'bar',
		},
	);
}

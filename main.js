
const { IDLE_TIMEOUT,
        GROUP_BROADCAST,
        GROUP_PREFIX   } = require('extws-server/src/data');
const ExtWSDriver        = require('extws-server/src/driver');
const ExtWSClient        = require('extws-server/src/client');
const { Address6 }       = require('ip-address');
const uWebSockets        = require('uWebSockets.js');

const subnet4in6 = new Address6('::ffff:0:0/96');

class ExtWSOnUWebSocketsDriver extends ExtWSDriver {
	constructor ({
		port,
		path,
		payload_max_length,
	}) {
		super();

		this._uws_server = uWebSockets.App();

		this._uws_server.ws(
			path,
			{
				compression: 1,
				maxPayloadLength: payload_max_length,
				idleTimeout: IDLE_TIMEOUT, // seconds

				upgrade: (response, request, context) => {
					const headers = {};
					request.forEach((key, value) => {
						headers[key] = value;
					});

					response.upgrade(
						{
							url: new URL(
								request.getUrl() + '?' + request.getQuery(),
								'ws://' + headers.host,
							),
							headers,
						},
						request.getHeader('sec-websocket-key'),
						request.getHeader('sec-websocket-protocol'),
						request.getHeader('sec-websocket-extensions'),
						context,
					);
				},
				open: (uws_client) => {
					uws_client.subscribe(GROUP_BROADCAST);

					const client = new ExtWSOnUWebSocketsClient(
						this,
						uws_client,
					);

					uws_client._extws = {
						id: client.id,
					};

					{
						const ip_address = Address6.fromUnsignedByteArray(
							Buffer.from(
								uws_client.getRemoteAddress(),
							),
						);
						// console.log('IP', Buffer.from(uws_client.getRemoteAddress()));
						// console.log('IP', ip_address);

						const is_v4 = ip_address.isInSubnet(subnet4in6);
						// console.log('IP is_v4', is_v4);
						client.remoteAddress = (is_v4 ? ip_address.to4() : ip_address).address;
						// console.log('IP remoteAddress', client.remoteAddress);
						client.remoteAddress6 = is_v4 ? Address6.fromAddress4(client.remoteAddress) : ip_address;
						// console.log('IP remoteAddress6', client.remoteAddress6);
					}

					client.headers = {};
					for (const [ key, value ] of Object.entries(uws_client.headers)) {
						client.headers[key] = value;
					}

					client.url = uws_client.url;

					this._onConnect(client);
				},
				message: (uws_client, payload, is_binary) => {
					const client = this.clients.get(uws_client._extws.id);

					if (client instanceof ExtWSClient) {
						if (!is_binary) {
							this._onMessage(
								client,
								Buffer.from(payload).toString(),
							);
						}
					}
				},
				close: (uws_client) => {
					const client = this.clients.get(uws_client._extws.id);
					if (client instanceof ExtWSClient) {
						client.disconnect(
							true, // is_already_disconnected
						);
					}
				},
			},
		);

		this._uws_server.listen(
			port,
			() => {},
		);
	}

	publish (channel, payload) {
		this._uws_server.publish(
			channel,
			payload,
		);
	}
}

module.exports = ExtWSOnUWebSocketsDriver;

class ExtWSOnUWebSocketsClient extends ExtWSClient {
	constructor (driver, uws_client) {
		super();

		this._driver = driver;
		this._uws_client = uws_client;
	}

	emit (payload) {
		try {
			this._uws_client.send(payload);
		}
		catch {
			this.disconnect();
		}
	}

	join (group_id) {
		try {
			this._uws_client.subscribe(
				GROUP_PREFIX + group_id,
			);
		}
		catch {
			// console.log('error happened @ join');
			this.disconnect();
		}
	}

	leave (group_id) {
		try {
			this._uws_client.unsubscribe(
				GROUP_PREFIX + group_id,
			);
		}
		catch {
			// console.log('error happened @ leave');
			this.disconnect();
		}
	}

	disconnect (
		is_already_disconnected = false,
		hard = false,
	) {
		if (true === hard) {
			try {
				this._uws_client.close();
			}
			catch {}
		}
		else if (true !== is_already_disconnected) {
			try {
				this._uws_client.end();
			}
			catch {}
		}

		super.disconnect();
	}
}

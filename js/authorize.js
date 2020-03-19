AIM.extend({
	checkResponse: function(event) {
		if (event.status >= 400) return this.showError(this.responses && this.responses[event.status] ? this.responses[event.status].description : __('Response error %s %s', event.status, event.statusText) );
		if (!event.data) return;
		AIM.responseData = event.data;
		if (event.data.prompt) return AIM.request('?prompt=' + event.data.prompt);
		document.location.href = '/api/oauth2' + document.location.search;
	},
	prompt: {
		logout: {
			show: function () {
				document.location.href = '/api/oauth2' + new AIM.URLSearchParams(document.location.search).merge({prompt:'logout'}).toString() //'https://login.aliconnect.nl/api/oauth2?prompt=logout';
			},
		},
		consent: {
			show: function () {
				// console.log('JA');
				return AIM.request({query:{prompt:'login'}});
			}
		},
		request_access: {
			show: function () {
				var form = {
					title: 'request_access',
					description: 'Geen aliconnect account. Ga op uw mobile naar https://login.aliconnect.nl. Maak een account aan en scan onderstaande code.',
					properties: [
						{ tagName: 'div', id: 'authcode' },
					],
					onload : function (event) {
						this.responses = {
							200: {description: 'successful operation' },
							404: {description: __('Email or phonenumber not found', this.accountname.value) },
						};
						AIM.checkResponse.call(this,event);
					}
				};
				(this.el = this.el || colpanel.appendTag('form',{className:'col aco '})).appendForm(form);
				new QRCode('authcode', { text: AIM.ws.sid, width: 140, height: 140 });
			},
		},
		login: {
			show: function () {
				console.log(screen.width);
				let minAppWidth = 400;
				(this.el = this.el || colpanel.appendTag('form',{className:'col aco '})).appendForm({
					title: 'Login',
					// description: `` + (AIM.cookie.id_token ? JSON.parse(atob(AIM.cookie.id_token.split('.')[1])).name  : ''),
					properties: [
						// AIM.cookie.id_token ? null : { name: 'accountname', type:'text', autocomplete:'username', required:true, autofocus:true, title: 'Email address or phone number' },
						// AIM.cookie.id_token ? null : { name: 'loginpassword', type:'password', autocomplete:'off', title: 'Password' },
						!AIM.cookie.id_token || screen.width > minAppWidth ? { name: 'accountname', type:'text', autocomplete:'username', required:true, autofocus:true, title: 'Email address or phone number' } : null,
						!AIM.cookie.id_token || screen.width > minAppWidth ? { name: 'loginpassword', type:'password', autocomplete:'off', title: 'Password' } : null,
						screen.width < minAppWidth && !AIM.cookie.id_token ? null : { tagName: 'button', type:'button', id: 'el_cam', innerText:'CAM', className:'cam', onclick: AIM.cam.start },
						screen.width > minAppWidth ? { tagName: 'div', id: 'authcode' } : null,
					],
					hyperlinks: [
						screen.width < minAppWidth && AIM.cookie.id_token ? null : { innerText: 'No account?', label: 'Create account now', href: '#?prompt=add_account' },
						screen.width > minAppWidth ? { label: 'Login options', href: '#?prompt=login_options' } : null,
						// { label: 'Logout_now', href: '#?logout' },
						screen.width > minAppWidth ? { label: 'Developers', href: 'https://aliconnect.nl/lib/docs/#/Docs/Start' } : null,
						AIM.cookie.id_token ? {label: __('Logout_now', JSON.parse(atob(AIM.cookie.id_token.split('.')[1])).name), href: '#?prompt=logout'} : null,
					],
					operations: [
						// { type:'button', label: 'Cancel', value: 'changepassword', onclick: function() {AIM.request('?prompt=login');} },
						!AIM.cookie.id_token || screen.width > minAppWidth ? { type:'submit', default: true, label: 'Next' } : null,
					],
					onload : function (event) {
						// console.log(event);
						this.responses = {
							200: {description: 'successful operation' },
							404: {description: __('Email or phonenumber not found', this.accountname.value) },
						};
						AIM.checkResponse.call(this,event);
					}
				});
				if (document.getElementById('authcode')) new QRCode('authcode', { text: AIM.ws.sid, width: 140, height: 140 });
				// if (AIM.cookie.id_token) document.getElementById("el_cam").onclick = AIM.video.start;
			},
		},
		login_password: {
			title: 'Enter password',
			show: function () {
				// console.log('aaaa',AIM.prompt.login.el);
				if (!AIM.prompt.login.el) return AIM.request('?prompt=login');
				(this.el = this.el || colpanel.appendTag('form',{className:'col aco', method:'post'})).appendForm({
					title: this.title,
					// description: AIM.prompt.login.data.Email,
					properties: [
						{ name: 'accountname', type:'text', autocomplete:'username', required:true, value:AIM.responseData.accountname },
						{ name: 'password', type:'password', autocomplete:'off', required:true, autofocus:true, tabindex:2, title: 'Password' },
						{ id: 'keep_loggedin', name: 'keep_loggedin', type:'checkbox', title: 'Keep logged-in' },
					],
					hyperlinks: [
						{ label: 'Show password', onclick: function(event){ colpanel.password.type = colpanel.password.type != 'text' ? 'text' : 'password'; }},
						{ label: 'No access to your account?', href: '#?prompt=get_code' },
						// { label: 'No password', href: '#?prompt=getEmailCode' },
						{ label: 'Other signin methods', href: '#?prompt=loginoptions' },
					],
					operations: [
						// { type:'button', label: 'Cancel', href: '#?prompt=login' },
						// { type:'button', label: 'Cancel', onclick: function () { window.history.back(); } },
						{ type:'submit', default: true, label: 'Login' },
					],
					responses: {
						401: {description: 'Error Password invalid'},
					},
					onload: AIM.checkResponse.bind(this.el),
				});
				if (get.client) AIM.ws.request({ to: { client: get.client }, state: 'loginopen', description: 'Login pagina is opgestart' });
			},
		},
		login_options: {
			title: 'Login options',
			show: function () {
				(this.el = this.el || colpanel.appendTag('form',{className:'col aco'})).appendForm({
					title: this.title,
					hyperlinks: [
						{ label: 'Use access token', href: '#?prompt=accesstoken' },
						{ label: 'Use authentication app', href: '#?prompt=authapp' },
						{ label: 'Login mobile phone', href: '#?prompt=loginmobile' },
						{ label: 'Login with password', href: '#?prompt=login' },
					],
					operations: [
						{ type:'button', label: 'Cancel', href: '#?prompt=login' },
					]
				});
			},
		},
		requestNewPasswordByEmail: {
			title: 'requestNewPasswordByEmail',
			show: function () {
				(this.el = this.el || colpanel.appendTag('form',{className:'col aco'})).appendForm({
					title: this.title,
					description: 'requestNewPasswordByEmailDescription',
					properties: [
						{ name: 'accountname', type:'email', autocomplete:'username', required:true, autofocus:true, title: 'E-mailadres' },
					],
					operations: [
						{ type:'submit', default: true, label: 'Next' },
					],
					onload : function (event) {
						AIM.prompt.login.data = event.data;
						if (event.target.status == 404) return this.showError('Email unknown', this.accountname.value);
						return AIM.request('?prompt=getEmailCode');
					}
				});
			},
		},
		add_account: {
			show: function () {
				// console.log(AIM.lang);
				(this.el = this.el || colpanel.appendTag('form',{className:'col aco'})).appendForm({
					title: 'Create account',
					properties: [
						{ name: 'accountname', type: 'email', autocomplete: 'off', title: 'Enter email address', autofocus: true },
					],
					operations: [
						{ type:'button', label: 'Cancel', href: '#?prompt=login' },
						{ type:'submit', default: true, label: 'Next' },
					],
					onload: function(event) {
						this.responses = {
							200: {description: 'successful operation' },
							403: {description: __('Email in use', this.accountname.value) },
						};
						AIM.checkResponse.call(this,event);
					},
				});
			},
		},
		get_mobile: {
			show: function () {
				if (!AIM.cookie.id_token) return AIM.request('?prompt=login');
				var user = JSON.parse(atob(AIM.cookie.id_token.split('.')[1]));
				// console.log(JSON.parse(atob(AIM.cookie.id_token.split('.')[1])));
				(this.el = this.el || colpanel.appendTag('form',{className:'col aco'})).appendForm({
					title: 'Get mobile number',
					description: 'Get mobile number description',
					properties: [
						{ name: 'accountname', type:'hidden', value:user.email },
						{ name: 'mobilenumber', type:'tel', autocomplete:'off', autofocus:true, required:true, tabindex:1, title: 'Your mobile number' },
					],
					operations: [
						// { type:'button', label: 'Skip', href: '#?prompt=login' },
						{ type:'submit', default: true, label: 'Next' },
					],
					responses: {
						403: {description: 'Forbidden Number in use'},
					},
					onload: AIM.checkResponse.bind(this.el),
				});
			},
		},
		set_code: {
			show: function () {
				(this.el = this.el || colpanel.appendTag('form',{className:'col aco'})).appendForm({
					title: 'set_code',
					description: 'set_code_description',
					properties: [
						{ name: 'accountname', type: 'text', autocomplete: 'off', title: 'Enter email address or phone number', autofocus: true },
					],
					operations: [
						{ type:'button', label: 'Back', href: '#?prompt=login' },
						{ type:'submit', default: true, label: 'Next' },
					],
					responses: {
						// 401: {description: 'Error safetycode invalid'},
						// 408: {description: 'Error safetycode timout'},
					},
					onload: AIM.checkResponse.bind(this.el),
				});
			},
		},
		get_code: {
			show: function () {
				if (!AIM.responseData) return AIM.request('?prompt=set_code');
				(this.el = this.el || colpanel.appendTag('form',{className:'col aco'})).appendForm({
					title: 'get_code',
					description: 'get_code_description',
					properties: [
						{ name: 'accountname', type:'hidden', value:AIM.responseData.accountname||'' },
						{ name: 'mobilenumber', type:'hidden', value:AIM.responseData.mobilenumber||'' },
						{ name: 'code', type:'number', min:11111, max:99999, autocomplete:'off', required:true, title: __('Enter code here'), autofocus: true },
					],
					operations: [
						{ type:'button', label: 'Back', href: '#?prompt=login' },
						{ type:'button', label: 'Resend', href: '#?prompt=get_code' },
						{ type:'submit', default: true, label: 'Next' },
					],
					responses: {
						401: {description: 'Error safetycode invalid'},
						408: {description: 'Error safetycode timout'},
					},
					onload: AIM.checkResponse.bind(this.el),
				});
				AIM.api.request({ path: '?prompt=set_code', form: this.el });
			},
		},
		set_password: {
			show: function () {
				if (!AIM.responseData || !AIM.responseData.Email) return AIM.request('?prompt=login');
				(this.el = this.el || colpanel.appendTag('form',{ className:'col aco', method:'post' })).appendForm({
					title: 'Set password',
					description: 'Set password description',
					properties: [
						{ name: 'accountname', type:'email', autocomplete:'username', required:true, value: AIM.responseData.Email },
						{ name: 'code', type:'hidden', value: AIM.responseData.code },
						{ name: 'password', type:'password', autocomplete:'new-password', required:true, title: 'Password', autofocus: true },
						{ name: 'password2', type:'password', autocomplete:'new-password', required:true, title: 'Repeat_password' },
					],
					hyperlinks: [
						{ label: 'Create_random_password', onclick:function(event){ AIM.prompt.setpassword.el.password1.value = AIM.prompt.setpassword.el.password2.value = AIM.randompassword(); } },
						{ label: 'Show_password', onclick:function(event){ AIM.prompt.setpassword.el.password1.type = AIM.prompt.setpassword.el.password2.type = AIM.prompt.setpassword.el.password1.type!='text'?'text':'password' } },
					],
					operations: [
						{ type:'button', label: 'Cancel', href: '#?prompt=login' },
						{ type:'submit', label: 'Next', default: true },
					],
					onload: AIM.checkResponse.bind(this.el),
				});
			},
		},
		accept: {
			show: function () {
				if (!AIM.cookie.id_token) return AIM.request({search: { prompt:'login' }});
				(this.el = this.el || colpanel.appendTag('form',{ className:'col aco' })).appendForm({
					title: 'Accepteer toegang tot uw gegevens',
					description: __('De applicatie %s wil toegang tot de volgende gegevens.',AIM.loginData ? AIM.loginData.hostTitle : ''),
					properties: [
						AIM.ws.responseData ? { name: 'sid', type:'hidden', value: AIM.ws.responseData.from || '' } : null,
					],
					operations: [
						// { type:'button', label: 'Cancel', value: 'changepassword', onclick: function() {AIM.request('?prompt=login');} },
						{ type:'submit', name: 'accept', value: 'deny', label: 'Deny' },
						{ type:'submit', name: 'accept', value: 'allow', label: 'Allow', default: true },
					],
				});
				with (this.el.msg.appendTag('ul')) {
					if (get.scope) decodeURIComponent(get.scope).split('+').forEach(function(scope){
						appendTag('li',{innerText:__(scope)});
					});
				}
				if (AIM.ws.responseData) {
					this.el.addEventListener('submit', function(event){
						AIM.ws.request({ to: { sid: AIM.ws.responseData.from }, path: new AIM.URLSearchParams(document.location.search).merge({prompt:'authapp_accept_done'}).toString() } );
					});
					AIM.ws.request({ to: { sid: AIM.ws.responseData.from }, path: new AIM.URLSearchParams(document.location.search).merge({prompt:'authapp_accept_active'}).toString() } );
				}
			},
		},
		allow: {
			show: function () {
				return;
				//if (!AIM.loginData) return AIM.nav({ prompt: 'login' });
				if (!this.innerHTML) this.innerHTML = `
				<div class="aco">
				<div><a class="abtn icn arrowLeft" href="#?prompt=login" tabindex="1"></a><span class="userName"></span></div>
				<h1>Uw toestemming is verwerkt.</h1>
				</div>
				`;
				AIM.ws.request({ to: { sid: AIM.ws.responseData.from }, prompt: 'reload' });
				document.location.href = decodeURIComponent(auth.redirect_uri) || document.location.href;
			},
		},
		deny: {
			show: function () {
				if (!this.innerHTML) this.innerHTML = `
				<div class="aco">
				<div><a class="abtn icn arrowLeft" href="#?prompt=login" tabindex="1"></a><span class="userName"></span></div>
				<h1>Uw weigering is verwerkt.</h1>
				</div>
				`;
				AIM.ws.request({ to: { sid: AIM.ws.responseData.from }, prompt: 'reload' });
				document.location.href = decodeURIComponent(auth.redirect_uri) || document.location.href;
			},
		},
		reload: {
			show: function () {
				document.location.reload();
			},
		},
		authapp_sid: {
			show: function () {
				if (!AIM.ws.responseData) return AIM.request('?prompt=login');
				(this.el = this.el || colpanel.appendTag('form',{className:'col aco', method:'post'})).appendForm({
					title: 'authapp_sid', // Code ontvangen van authenticator app
					description: 'Code received from authenticator app, request send to app',
				});
				AIM.ws.request({ to: { sid: AIM.ws.responseData.from }, path: new AIM.URLSearchParams(document.location.search).merge({prompt:'accept'}).toString() } );
				// AIM.ws.request({ to: { sid: AIM.ws.responseData.from }, path: document.location.search } );
			},
		},
		authapp_accept_active: {
			show: function () {
				(this.el = this.el || colpanel.appendTag('form',{className:'col aco', method:'post'})).appendForm({
					title: 'authapp_accept_active',
					description: 'Accepteer toegang tot de gevraagde informatie op uw mobiel',
				});
			},
		},
		authapp_accept_done: {
			show: function () {
				(this.el = this.el || colpanel.appendTag('form',{className:'col aco', method:'post'})).appendForm({
					title: 'authapp_accept_done',
					description: 'Uw keuze wordt verwerkt.',
				});
			},
		},
		authapp_send_id_token: {
			show: function () {
				(this.el = this.el || colpanel.appendTag('form',{ className:'col aco' })).appendForm({
					title: 'authapp_send_id_token',
					description: 'U wordt aangemeld.',
					// description: __('De applicatie %s wil toegang tot de volgende gegevens.',AIM.loginData ? AIM.loginData.hostTitle : ''),
				});
				AIM.ws.request({ to: { sid: get.sid }, path: new AIM.URLSearchParams(document.location.search).merge({ prompt:'authapp_accept_id_token', id_token:AIM.cookie.id_token }).toString() } );
			}
		},
		authapp_accept_id_token: {
			show: function () {
				AIM.ws.request({ to: { sid: AIM.ws.responseData.from }, path: '?prompt=login' } );
				if (AIM.prompt.request_access.el) {
					(this.el = this.el || colpanel.appendTag('form',{className:'col aco', method:'post'})).appendForm({
						title: 'bedankt voor toegang tot uw gegevens',
						description: '',
					});
					setTimeout(function(event){ return AIM.request({query:{prompt:'request_access', id_token:null, sid:null }}); },3000);
				}
				else {
					document.location.href = '/api/oauth2' + new AIM.URLSearchParams(document.location.search).merge({ prompt:'login' }).toString();
				}
			}
		},
		requestfordata: {
			show: function () {
				console.log('requestfordata', get.client);
				AIM.ws.request({ to: { client: get.client }, state: 'requestfordatashow' });
			},
		},
		waitforallow: {
			create: function (el) {
				with (el) {
					with (appendTag('div', { className: 'aco' })) {
						appendTag('h1', { innerText: 'We wachten op uw acceptatie' });
						this.elWelkom = appendTag('p');//, { innerText: 'Welkom '+user.userName+', u kunt het delen van uw gegevens acceptere of weigeren.' });
					}
				}
			},
			show: function () {
				this.elWelkom.innerText = 'Welkom ' + user.userName + ', u kunt het delen van uw gegevens acceptere of weigeren.';
			},
		},
		allowrequestfordata: {
			// op mobile device
			create: function (el) {
				with (el) {
					with (appendTag('div', { className: 'aco' })) {
						appendTag('h1', { innerText: 'Verzoek om informatie' });
						appendTag('p', { innerText: 'De applicate ... van ... vezoekt op de volgende gegevens.' });
						appendTag('p', { innerText: get.scope });
						appendTag('p', { innerText: 'U blijft eigenaar van deze gegevens. Zij worden alleen gebruikt waarvoor u deze gegevens deelt.' });
					}
					with (appendTag('div', { className: 'row btns' })) {
						appendTag('button', { innerText: "Weigeren", type: "submit", className: "button", name: "deny", onclick: function () { this.value = true; }, tabindex: -1 });
						appendTag('button', { innerText: "Delen", type: "submit", className: "button", name: "allow", onclick: function () { this.value = true; }, tabindex: -1 });
					}
				}
			},
			show: function () {
				//elMsg.innerText = 'Request for data';
				document.getElementById("canvas").style.display = 'none';
				video.style.display = 'none';
				AIM.ws.request({ to: { client: this.client = wssdata.from.client }, state: 'waitforallow' });

			},
			submit: function (event) {
				var post = { AccountID: auth.AccountID };
				for (var i = 0, el; el = this.elements[i]; i++) if (el.name) post[el.name] = el.value;
				console.log('allowrequestfordata', post);
				var state = post.allow ? 'allowrequestfordataok' : 'allowrequestfordatanok';
				//auth.prompt(state);
				AIM.ws.request({ to: { client: this.client }, state: state, post: post }, function(){

				});

				//AIM.https.request({
				//	api: 'auth/' + this.id, post: post, form: this, onload: function () {
				//		this.form.getElementsByClassName('msg')[0].innerText = this.data.pwdcompare ? "" : "Incorrect wachtwoord.";
				//		if (this.data.pwdcompare) return document.location.href = decodeURIComponent(auth.redirect_uri) || document.location.href;
				//	}
				//});
				return false;
			},
		},
		allowrequestfordataok: {
			create: function (el) {
				with (el) {
					with (appendTag('div', { className: 'aco' })) {
						appendTag('h1', { innerText: 'Uw data ontvangen' });
						appendTag('p', { innerText: 'Uw keuze is verwerkt, wij danken u voor uw gegevens' });
					}
				}
			},
			show: function () {
				var values = { FirstName: 'Max', MiddleName: 'van', LastName: 'Kampen' };
				AIM.ws.request({ to: { client: this.client = wssdata.from.client }, state: 'reload' });
				AIM.ws.request({ to: { client: get.client }, state: 'datatransfered', values: values, description: 'Gegevens zijn aan u verstrekt' });
			},
		},
		allowrequestfordatanok: {
			create: function (el) {
				with (el) {
					with (appendTag('div', { className: 'aco' })) {
						appendTag('h1', { innerText: 'Uw data is niet gedeeld' });
						appendTag('p', { innerText: 'Tot onze spijt kunnen we u niet verder helpen.' });
					}
				}
			},
			show: function () {
				AIM.ws.request({ to: { client: this.client = wssdata.from.client }, state: 'login' });
				AIM.ws.request({ to: { client: get.client }, state: 'done', description: 'Gegevens zijn NIET verstrekt' });
			},
		},
		loginmobile: {
			title: 'Login_with_mobile',
			show: function () {
				this.el.appendForm({
					title: this.title,
					hyperlinks: [
						// { label: 'Verstuur een code via een email bericht', href:'#?prompt=getEmailCode' },
						// { label: 'Verstuur een code naar mijn mobiel', href:'#?prompt=getPhoneCode'  },
					],
					operations: [
						{ type:'button', label: 'Cancel', href: '#?prompt=login' },
						// { type:'submit', default: true, label: 'Next' },
					]
				});
			},
			//
			// show: function () {
			// 	if (!this.innerHTML) this.innerHTML = `
			// 	<div class="aco">
			// 	<h1>Aanmelden met uw mobiel</h1>
			// 	<div><input name="mobile" type="tel" placeholder="0600000000" tabindex="1"></div>
			// 	<p><a href="#?prompt=login">Aanmelden met gebruikersnaam en wachtwoord</a></p>
			// 	</div>
			// 	<div class="row btns">
			// 	<button type="submit" class="button">Volgende</button>
			// 	</div>
			// 	`;
			// },
		},
		authapp: {
			title: 'Authenticator app',
			show: function () {
				this.el.appendForm({
					title: this.title,
					properties: [
						// { name: 'access_token', type:'text', autocomplete:'off', title: 'access_token' },
					],
					operations: [
						{ type:'button', label: 'Back', href: '#?prompt=loginoptions' },
						{ type:'submit', label: 'Next', default: true },
					]
				});
			},
		},
		accesstoken: {
			title: 'Access Token',
			show: function () {
				this.el.appendForm({
					title: this.title,
					properties: [
						{ name: 'access_token', type:'text', autocomplete:'off', title: 'access_token' },
					],
					operations: [
						{ type:'button', label: 'Back', href: '#?prompt=loginoptions' },
						{ type:'submit', label: 'Next', default: true },
					]
				});
			},
		},
		newpassword: {
			show: function(){
				if (!this.innerHTML) this.innerHTML = `
				<div class="aco">
				<div class="msg"></div>
				<h1>Je wachtwoord opnieuw instellen</h1>
				<p>Er is een email verstuurd naar uw account email adres. Open deze email en voer de beveiligingscode hieronder in</p>
				<p><input name="code" placeholder="Beveiligingscode" ></p>
				<p><a href="#?prompt=newpassword">Code nogmaals versturen</a></p>
				</div>
				<div class="row btns">
				<button type="button" class="button" onclick="AIM.nav({ prompt: 'login' });" >Annuleren</button>
				<button type="submit" class="button" >Volgende</button>
				</div>
				`;
			}
		},
		developers: {
			show: function() {
				if (!this.innerHTML) this.innerHTML = `
				<div class="aco">
				<div class="msg"></div>
				<h1>Ontwikkelaars</h1>
				<p>Geen domein? <a href="#?prompt=createdomain" >Maak nu een domein</a></p>
				</div>
				<div class="row btns">
				<button type="button" class="button" onclick="AIM.prompt('login');" >Annuleren</button>
				</div>
				`;
			}
		},
		createdomain: {
			show: function() {
				if (!this.innerHTML) this.innerHTML = `
				<div class="aco">
				<div class="msg"></div>
				<h1>Maak een domein</h1>
				<p><input name="domain" autocomplete="off" placeholder="Voer een domein naam in" ></p>

				</div>
				<div class="row btns">
				<button type="button" class="button" onclick="AIM.prompt('developers');" >Annuleren</button>
				<button type="submit" class="button" >Volgende</button>
				</div>
				`;
			}
		},
		// phone_accept1: {
		// 	show: function () {
		// 		//if (!AIM.loginData) return AIM.nav({ prompt: 'login' });
		// 		console.log("AIM.ws.responseData",AIM.ws.responseData);
		//
		// 		if (!this.innerHTML) this.innerHTML = `
		// 		<div class="aco">
		// 		<div><a class="abtn icn arrowLeft" href="#?prompt=login" tabindex="1"></a><span class="userName"></span></div>
		// 		<h1>Accepteer toegang tot uw gegevens</h1>
		// 		<p>De applicatie "${AIM.loginData ? AIM.loginData.hostTitle : ''}" wilt toegang tot de volgende gegevens:</p>
		// 		<ul id="scope"><li>${AIM.ws.responseData.scope.split('+').join('</li><li>')}</li></ul>
		// 		<p>Geef op deze mobiel toegang tot deze gegegevens.</p>
		// 		</div>
		// 		`;
		// 		with (this.appendTag('div',{className:"row btns"})) {
		// 			appendTag('button',{className:"button",innerText:"Weigeren",type:"button",onclick:function(event){
		// 				AIM.ws.request({ to: { sid: AIM.ws.responseData.from.sid }, prompt: 'deny' });
		// 				auth.prompt("login");
		// 				return false;
		// 			}});
		// 			appendTag('button',{className:"button",innerText:"Toestaan",type:"button",onclick:function(event){
		// 				AIM.ws.request({ to: { sid: AIM.ws.responseData.from.sid }, prompt: 'allow' });
		// 				auth.prompt("login");
		// 				return false;
		// 			}})
		//
		// 		}
		// 		// console.log( decodeURI(get.scope), AIM.loginData.scope);
		// 		//if (AIM.loginData && decodeURIComponent(get.scope) == AIM.loginData.scopeUser) btnAllow.click();//colpanel.submit();
		// 	},
		// },
	},
	redirect_uri: document.location.search.split('redirect_uri=').pop().split('&').shift(),
	randompassword: function () {
		a = [];
		for (var i = 0; i < 20; i++) {
			// a.push(String.fromCharCode(48 + Math.round(74 * Math.random())));
			a.push(String.fromCharCode(33 + Math.round((126-33) * Math.random())));
		}
		return a.join('');
	},
	cam: {
		start: function(event){
			video = AIM.cam.el = AIM.cam.el || document.createElement("video");
			//video.style.display = '';
			video.setAttribute('playsinline', '');
			canvasElement = document.getElementById("canvas");
			canvasElement.style.display = '';
			//canvasElement.style.display = '';
			canvas = canvasElement.getContext("2d");

			function drawLine(begin, end, color) {
				canvas.beginPath();
				canvas.moveTo(begin.x, begin.y);
				canvas.lineTo(end.x, end.y);
				canvas.lineWidth = 4;
				canvas.strokeStyle = color;
				canvas.stroke();
			}

			navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(function (stream) {
				videostream = video.srcObject = stream;
				video.setAttribute("playsinline", true); // required to tell iOS safari we don't want fullscreen
				video.play();
				requestAnimationFrame(tick);
			});

			function tick() {
				if (video.readyState === video.HAVE_ENOUGH_DATA) {
					canvasElement.hidden = false;
					canvasElement.height = video.videoHeight;
					canvasElement.width = video.videoWidth;
					canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
					var imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
					var code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert", });
					if (code) {
						drawLine(code.location.topLeftCorner, code.location.topRightCorner, "#FF3B58");
						drawLine(code.location.topRightCorner, code.location.bottomRightCorner, "#FF3B58");
						drawLine(code.location.bottomRightCorner, code.location.bottomLeftCorner, "#FF3B58");
						drawLine(code.location.bottomLeftCorner, code.location.topLeftCorner, "#FF3B58");
						if (code.data) {
							AIM.cam.stop();
							AIM.ws.request({ to: { sid: code.data }, path: '#?prompt=authapp_sid' }, function() {
								alert('SEND OK');
							});
						}
					}
				}
				requestAnimationFrame(tick);
			}
		},
		stop: function(event){
			//video.pause();
			videostream.getTracks().forEach(track => track.stop())
			canvasElement.style.display = 'none';
			//canvas.clearRect(0, 0, canvasElement.width, canvasElement.height);
			//document.removeChild(videoElement);
		},
	},
	on: {
		// message: function (event) {
		// 	// console.log('auth message', event.data);
		// 	AIM.ws.responseData = event.data;
		// 	//var elMsg = document.getElementById('divExtra');
		// 	//console.log('auth message state', data.state);
		// 	//if (document.getElementById(data.state)) auth.prompt(data.state);
		// 	// AIM.request(data);
		// 	// if (data.path) AIM.req ()auth.openprompt(data.prompt);
		//
		// 	// switch (data.state) {
		// 	// 	case 'reload':
		// 	// 		document.location.reload();
		// 	// 		break;
		// 	// 	case 'scanned':
		// 	// 		console.log('auth message state', data.state, data.id_token);
		// 	//
		// 	//
		// 	//
		// 	// 		//document.getElementById('UserName').value = data.user.userName;
		// 	// 		console.log('auth message state', event);
		// 	//
		// 	// 		AIM.ws.request({ to: { sid: data.from.sid }, state: 'allowrequestfordata' });
		// 	// 		//AIM.ws.request({ to: { client: get.client }, state: 'allowrequestfordata', description: 'Code is gescanned, verzoek om acceptatie' });
		// 	//
		// 	// 		//console.log('auth message state', data.state);
		// 	// 		break;
		// 	// 	case 'allowrequestfordata':
		// 	// 		elMsg.innerText = 'Request for data';
		// 	// 		document.getElementById("canvas").style.display = 'none';
		// 	// 		video.style.display = 'none';
		// 	// 		AIM.ws.request({ to: { client: data.from.client }, state: 'waitforallow' });
		// 	// 		btnLogout.style.display = btnNext.style.display = 'none';
		// 	// 		btnDeny.style.display = btnAllow.style.display = '';
		// 	// 		btnDeny.onclick = function () { AIM.ws.request({ to: { client: wssdata.from.client }, state: 'deny' }); return false; };
		// 	// 		btnAllow.onclick = function () { AIM.ws.request({ to: { client: wssdata.from.client }, state: 'allow' }); return false; };
		// 	// 		break;
		// 	// 	case 'waitforallow':
		// 	//
		// 	// 		break;
		// 	//
		// 	// 	case 'allow':
		// 	// 		AIM.ws.request({ to: { client: this.data.from.client }, state: 'done' });
		// 	// 		document.location.href = get.redirect_uri;
		// 	// 		break;
		// 	// 	case 'deny':
		// 	// 		AIM.ws.request({ to: { client: this.data.from.client }, state: 'done' });
		// 	// 		document.location.href = get.redirect_uri;
		// 	// 		break;
		// 	// 	case 'done':
		// 	// 		document.location.reload();
		// 	// 		break;
		// 	// }
		// },
		load: function () {
			if (window.screen.width > 600) document.body.style.backgroundImage = 'url("/shared/auth/i' + Math.round(new Date().getDay()/30 * 12) + '.jpg")';
			// colpanel.onsubmit = function (event) {
			// 	colpanel.action = AIM.config.oauth2.basePath + document.location.search;
			// 	if (!AIM.prompt.tmp.focusPanel.onload) return;
			// 	AIM.api.request({ path: document.location.search, form: this }, AIM.prompt.tmp.focusPanel.onload.bind(this));
			// 	return false;
			// };
		},
		init: function () {
			get = new AIM.URLSearchParams(document.location.search);
			console.log('INIT', get.prompt != 'consent',AIM.cookie.id_token, get);
			AIM.id_token = AIM.cookie.id_token;
			if (!get.prompt) return document.location.href='#?prompt=login'; //return AIM.request('?prompt=login');
			if (get.prompt != 'consent' && AIM.cookie.id_token && get.response_type == 'code') return document.location.href='#?prompt=accept'; //AIM.request({query:{prompt:'accept'}});
			// setInterval(function(){if (AIM.id_token != AIM.cookie.id_token) document.location.reload();},5000);
		}
	}
});
// if ('serviceWorker' in navigator) {
// 	navigator.serviceWorker.register('/lib/js/sw.js', { scope: '/' })
// 	.then(function(registration) {
// 		console.log('Registration successful, scope is:', registration.scope);
// 		return;
// 		registration.pushManager.subscribe({userVisibleOnly: true}).then(function(sub) {
// 			console.log('endpoint:', sub.endpoint);
// 			registration.active.postMessage(JSON.stringify({uid: 13255, token: 2234523}));
// 			console.log("Posted message");
// 		});
// 	})
// 	.catch(function(error) {
// 		console.log('Service worker registration failed, error:', error);
// 	});
// }

<?php
class oauth2 {
	private static $authTokenUrl = 'https://login.aliconnect.nl/oauth2/token';
	private static function login ($account) {
		if (!$account->IP) {
			require_once (__AIMSERVER__.'/mail.php');
			(new mailer())->send([
				'to'=> $account->Email,
				'bcc'=> 'max.van.kampen@alicon.nl',
				'Subject'=> __('New location mail subject'),
				'chapters'=> [
					[ 'title' => __('New location mail title'), 'content'=> __('New location mail content', $account->Email) ],
				],
			]);
			query("EXEC item.setAttribute @itemID=$account->AccountID, @NameID=1604, @Value='".$_SERVER['HTTP_CLIENT_IP']."', @max=9999");
		}
		$response = (object)[];
		$response->expires_in = 30 * 86400;
		if (array_key_exists('nonce',$_COOKIE)) query("UPDATE [auth].[nonce] SET LastModifiedDateTime=GETUTCDATE(),sub=$account->AccountID WHERE nonce='$_COOKIE[nonce]'");
		else $_COOKIE['nonce'] = (sqlsrv_fetch_object(query("SET NOCOUNT ON;DECLARE @nonce UNIQUEIDENTIFIER;SET @nonce=newid();INSERT auth.nonce(nonce,sub)VALUES(@nonce,$account->AccountID);SET NOCOUNT OFF;SELECT @nonce AS nonce")))->nonce;
		//$session = dbs::request("IF NOT EXISTS(SELECT 0 FROM auth.session WHERE id='".($nonce = $_COOKIE[nonce])."')INSERT auth.session(id)VALUES('$sessionID');UPDATE auth.session SET sub=$account->id WHERE id='$sessionID';SELECT * FROM auth.session WHERE id='$sessionID';")[0][0];
		$id_token = (object)[
			'iss' => 'login.aliconnect.nl',//aim::$access[iss],//'https://aliconnect.nl', //  Issuer, 'https://aliconnect.nl'
			'sub' => $account->AccountID, // Subject, id of user or device
			//'azp' => 1,//self::$config->clientid, // From config.json
			'nonce' => $_COOKIE['nonce'], // Value used to associate a Client session with an ID Token, must be verified
			'auth_time' => time(), // Time when the authentication occurred
			'iat' => time(), // Issued At
			'exp' => time() + $response->expires_in, // Expiration Time
			'name' => $account->AccountName,
		];
		$res = query("SELECT AttributeName,Value FROM [item].[attribute_list] WHERE ItemID=".$account->AccountID);
		$attributes=['GivenName'=>'given_name','Surname'=>'family_name','MiddleName'=>'middle_name','NickName'=>'nickname','UserName'=>'preferred_username','Email'=>'email','EmailVerified'=>'email_verified','Gender'=>'gender','Birthday'=>'birthdate','HomePhones0'=>'phone_number','PhoneVerified'=>'phone_number','PhoneVerified'=>'phone_number_verified','HomeAddress'=>'address','modifiedDT'=>'updated_at'];
		while ($row = sqlsrv_fetch_object($res)) if (array_key_exists($row->AttributeName,$attributes)) $id_token->{$attributes[$row->AttributeName]} = $row->Value;
    setcookie('id_token', $response->id_token = jwt_encode($id_token, aim::$secret['aim']['client_secret']), ['expires' => $id_token->exp, 'path' => '/', 'domain' => 'login.aliconnect.nl', 'secure' => 1, 'httponly' => 0, 'samesite' => 'Lax']);
    setcookie('access_token', $response->id_token = jwt_encode($id_token, aim::$secret['aim']['client_secret']), ['expires' => $id_token->exp, 'path' => '/', 'domain' => 'login.aliconnect.nl', 'secure' => 1, 'httponly' => 0, 'samesite' => 'Lax']);
		setcookie('nonce', $_COOKIE['nonce'], ['expires' => time() + 365 * 86400, 'path' => '/', 'domain' => 'login.aliconnect.nl', 'secure' => 1, 'httponly' => 0, 'samesite' => 'Lax']);
		return $account;
	}
	public static function get($param = null) {
		extract($_GET);
    if (!empty($prompt)) switch ($prompt) {
			case 'logout':
				query("UPDATE auth.nonce SET sub=NULL WHERE nonce='$_COOKIE[nonce]'");
        foreach (['id_token', 'access_token'] as $key) setcookie($key, $_COOKIE[$key] = null, ['expires' => null, 'path' => '/', 'domain' => $_SERVER['SERVER_NAME'], 'secure' => 1, 'httponly' => 1, 'samesite' => 'Lax' ]);
        $_GET['prompt'] = 'login';
        break;
		}
    if (!empty($response_type)) switch ($response_type) {
      case 'state':
        if (!isset(aim::$access)) return;
        if (!isset(aim::$access->nonce)) return;
        $nonce = aim::$access->nonce;
        $row = sqlsrv_fetch_object(query("SELECT * FROM [auth].[nonce] WHERE nonce='$nonce';"));
        if ($row->sub != aim::$access->sub) throw new Exception('Unauthorized', 401);
        debug(aim::$access, $row, $_COOKIE);
        return;
      case 'api_key':
        // debug($_POST);
        if (!empty($mac)) {
          $mac = str_replace(":","-",$mac);
          if (empty($sub = sqlsrv_fetch_object(query($q="SELECT ItemID,ID,HostID FROM item.attribute WHERE NameID=2020 AND Value='$mac' AND UserID IS NULL")))) throw new Exception("Forbidden", 403);
          if (empty($client = sqlsrv_fetch_object(query("EXEC [account].[get] @HostName='$client_id'")))) throw new Exception("Unauthorized", 401);
          query("UPDATE item.attribute SET UserID=$sub->ItemID WHERE ID=$sub->ID");
          $api_key = [
            'iss' => $client->ClientName.'.aliconnect.nl', // Audience, id of host, owner of scope
            'client_id' => $client->ClientID,
            'sub' => $sub->ItemID,
            'aud' => $sub->HostID,
            'auth_time' => time(),
            'exp' => time() + 60,
            'iat' => time(),
            // 'client_secret' => $client->client_secret,
          ];
        }
        if (empty($api_key)) throw new Exception('Unauthorized', 401);
        return ['api_key' => jwt_encode($api_key, $client->client_secret)];
      case 'code':
        if (!empty($id_token)) {
          $payload = json_decode(base64_decode(explode('.',$id_token)[1]));
          setcookie('id_token', $_COOKIE['id_token'] = $id_token, ['expires' => $payload->exp, 'path' => '/', 'domain' => 'login.aliconnect.nl', 'secure' => 1, 'httponly' => 0, 'samesite' => 'Lax']);
        }
        if (empty($prompt) || empty($response_type) || empty($client_id) || empty($scope) || empty($id_token = $_COOKIE['id_token']) || $prompt == 'consent' || empty($account_jwt = jwt_decode($id_token, aim::$secret['aim']['client_secret']))) break;
        if (empty($account_jwt->valid)) throw new Exception('Invalid id_token', 404);
        $payload = (array)$account_jwt->payload;
        $account = sqlsrv_fetch_object(query("EXEC [account].[get] @HostName='$client_id', @AccountID=$payload[sub]"));
        if (!$account->ContactID) break;
        if ($account->RequestScope!=$scope) break;
        $code = jwt_encode($c=array_replace( array_intersect_key( $payload, array_flip(array_merge(explode(' ', $scope),['sub','nonce','auth_time','name'] ) ) ),[
          'iss' => $account->ClientName.".aliconnect.nl", // Audience, id of host, owner of scope
          'aud' => (int)$account->ClientID, // Audience, id of host, owner of scope
          'azp' => (int)$account->ClientID, // From config.json
          'client_id' => (int)$account->ClientID, // Client Identifier // application
          'scope' => implode(' ',[$scope, $account->GrantScope]),//trim($scope . (isset($scope) ? ' '.$scope->scope : '' )), // Scope Values
          'exp' => time() + 60, // Expiration Time
          'iat' => time(), // Issued At
        ]), aim::$secret['aim']['client_secret'] );
        die(header('Location: '.explode('?',$redirect_uri)[0].'?'.http_build_query(['code'=>$code,'state'=>$state])));
    }
    die(header('Location: /?'.http_build_query($_GET)));
	}
	public static function post() {
		extract($_GET);
		extract($_POST);
    // debug($_GET,$_POST);
    // debug(1);
		define('ClientIP', microtime(true)*1000);
		$ip = GetRealUserIp();
		switch ($prompt) {
			case 'login':
				$account = sqlsrv_fetch_object(query("EXEC [account].[get] @accountname='$accountname'"));
				if (!$account) throw new Exception('Not found', 404);
				$account->accountname = $accountname;
				$account->prompt = 'login_password';
				return $account;
			case 'set_password':
				$account = sqlsrv_fetch_object(query($query = "EXEC [account].[get] @accountname='$accountname', @hostname='aliconnect', @code='$code'"));
				if (!$account->IsCodeOk) throw new Exception('Unauthorized', 401);
				$account->sec = time()-date_create($account->CodeLastModifiedDateTime)->getTimestamp();
				// if ($account->sec > 120) throw new Exception("Request Timeout", 408);
				$account = sqlsrv_fetch_object(query("EXEC item.setAttribute @itemID=$account->AccountID, @NameID=1604, @Value='$ip', @max=9999;EXEC [item].[setAttribute] @ItemID=$account->AccountID, @NameID=516, @UserID=$account->AccountID, @Value='$password', @Encrypt=1;".$query));
				// $account->mobilenumber = $account->Mobile;
				if (!$account->Mobile) $account->href = '?prompt=get_mobile';//$account->prompt='get_mobile';
				else if (!$account->IsMobileVerified) $account->href = '?prompt=get_code';
				return self::login($account);
			case 'login_password':
				if (!$ip) throw new Exception('Unauthorized', 401);
				$account = sqlsrv_fetch_object(query("EXEC [account].[get] @accountname='$accountname', @password='$password', @IP = '$ip'"));
				if (!$account) throw new Exception("Not found", 404);
				// debug($_POST, $ip);
				if (!(int)$account->IsPasswordOk) throw new Exception('Unauthorized', 401);
				$account->accountname = $accountname;
				$account->mobilenumber = $account->Mobile;
				if (!$account->Mobile) $account->href = '?prompt=get_mobile';//$account->prompt='get_mobile';
				else if (!$account->IsMobileVerified) $account->href = '?prompt=get_code';
				return self::login($account);
			case 'get_mobile':
				if (is_numeric($mobilenumber) && $mobilenumber > 600000000 && $mobilenumber < 700000000) $mobilenumber = 31000000000 + $mobilenumber;
				$account = sqlsrv_fetch_object(query("EXEC [account].[get] @accountname='$mobilenumber'"));
				if ($account) throw new Exception('Forbidden', 403);
				$account = sqlsrv_fetch_object(query("EXEC [account].[get] @accountname='$accountname'"));
				$account->mobilenumber = $mobilenumber;
				$account->accountname = $accountname;
				$account->prompt = 'get_code';
				return $account;
			case 'add_account':
				$account = sqlsrv_fetch_object(query($query = "EXEC [account].[get] @accountname='$accountname'"));
				if ($account) throw new Exception('Forbidden', 403);
				$query = "SET NOCOUNT ON;
					DECLARE @id INT;
					INSERT item.dt (hostID,classID,title) VALUES (1,1004,'$accountname');
					SET @id=scope_identity();
					EXEC [item].[setAttribute] @ItemID=@id, @NameID=30, @value='$accountname';
					EXEC [item].[setAttribute] @itemID=@id, @NameID=1604, @Value='$ip', @max=9999;
					$query
					";
				$account = sqlsrv_fetch_object(query($query));
				$account->accountname = $accountname;
				$account->prompt = 'get_code';
				return $account;
			case 'set_code':
				if (is_numeric($mobilenumber) && $mobilenumber > 600000000 && $mobilenumber < 700000000) $mobilenumber = 31000000000 + $mobilenumber;
				$account = sqlsrv_fetch_object(query("EXEC [account].[get] @accountname='$accountname'"));
				$code = rand(11111,99999);
				query("EXEC item.setAttribute @ItemID=$account->AccountID, @Name='code', @Value='$code', @encrypt=1");
				require_once (__AIMSERVER__.'/mail.php');
				if (is_numeric($mobilenumber)) {
					// sms::send('+'.$mobilenumber, __('Authentication sms content', $code), __('Authentication sms subject'));
					(new mailer())->send(['to'=> $accountname, 'bcc'=> "max.van.kampen@alicon.nl", 'Subject'=> __('Authentication sms subject'),'chapters'=> [[ 'title' => $mobilenumber, 'content'=> __('Authentication sms content', $code) ]],]);
				}
				else {
					(new mailer())->send(['to'=>$accountname, 'bcc'=> "max.van.kampen@alicon.nl", 'Subject'=> __('Authentication mail subject'), 'chapters'=> [[ 'title' => __('Authentication mail title'), 'content'=> __('Authentication mail content', $accountname, $code) ]] ]);
				}
				$account->mobilenumber = $mobilenumber;
				$account->accountname = $accountname;
				$account->prompt = 'get_code';
				return $account;
			case 'get_code':
				$account = sqlsrv_fetch_object(query($query = "EXEC [account].[get] @accountname='$accountname', @code='$code', @IP = '$ip'"));
				$account->sec = time()-date_create($account->CodeLastModifiedDateTime)->getTimestamp();
				if (!$account->IsCodeOk) throw new Exception('Unauthorized', 401);
				if ($account->sec > 60) throw new Exception('Request Timeout', 408);
				if (!$account->IsEmailVerified) $account = sqlsrv_fetch_object(query("EXEC [item].[setAttribute] @ItemID=$account->AccountID, @NameID=30, @Value='$accountname', @UserID=$account->AccountID;".$query));
				if ($mobilenumber && !$account->IsMobileVerified) $account = sqlsrv_fetch_object(query("EXEC [item].[setAttribute] @ItemID=$account->AccountID, @NameID=996, @Value='$mobilenumber', @UserID=$account->AccountID;".$query));
				$account->code = $code;
				$account->accountname = $accountname;
				if (is_null($account->IsPasswordOk)) $account->prompt = 'set_password';
				else if (!$mobilenumber) $account->prompt = 'set_password';
				else $account->href = '?prompt=login';
				return self::login($account);
			case 'accept':
        $code = '';
        if ($accept == 'allow') {
          if (empty($id_token = $_COOKIE['id_token'])) break;
          if (!empty($sid)) {
            $_GET['id_token'] = $id_token;
            $_GET['prompt']='authapp_send_id_token';
            $_GET['sid']=$sid;
            die(header('Location: /?'.http_build_query($_GET)));
          }
          if (!($account_jwt = jwt_decode($id_token, aim::$secret['aim']['client_secret']))) break;
          if (!$account_jwt->valid) break;
          $payload = (array)$account_jwt->payload;
          $account = sqlsrv_fetch_object(query($q="EXEC [account].[get] @HostName='$client_id', @AccountID=$payload[sub]"));
          // debug($account);
          if (!$account->ContactID) throw new Exception('No contact ID on host', 401);
          $scope = empty($scope) ? '' : $scope;
          query($query = "EXEC item.setAttribute @ItemID=$account->ContactID, @NameID=1994, @Value='$scope', @HostID=$account->ClientID, @UserID=$payload[sub];");
          $code = jwt_encode(array_replace( array_intersect_key( $payload, array_flip(array_merge(explode(' ', $scope),['sub','nonce','auth_time','name'] ) ) ),[
            'iss' => $account->ClientName.".aliconnect.nl", // Audience, id of host, owner of scope
            'aud' => (int)$account->ClientID, // Audience, id of host, owner of scope
            'azp' => (int)$account->ClientID, // From config.json
            'client_id' => (int)$account->ClientID, // Client Identifier // application
            'scope' => implode(' ',[$scope, $account->GrantScope]),//trim($scope . (isset($scope) ? ' '.$scope->scope : '' )), // Scope Values
            'exp' => time() + 60, // Expiration Time
            'iat' => time(), // Issued At
          ]), aim::$secret['aim']['client_secret']);
        }
        if (empty($redirect_uri)) die(header('Location: /?'.http_build_query(['code'=>$code,'state'=>$state])));
        $redirect_uri = explode('?',$redirect_uri)[0].'?'.http_build_query(['code'=>$code,'state'=>$state]);
        die (header('Location: '.$redirect_uri));
			case 'requestNewPasswordByEmail':
				$account = sqlsrv_fetch_object(query("EXEC [account].[get] @accountname='$accountname'"));
				if (!$account->EmailAttributeID) throw new Exception('Not found', 404);
				return $account;
		}
    die(header('Location: /?'.http_build_query($_GET)));
	}
	public static function redirect_code() {
		extract($_GET);
		if (!($id_token = $_COOKIE['id_token'])) throw new Exception('No logged in user', 401);
    $client = sqlsrv_fetch_object(query("EXEC [account].[get] @HostName='$client_id'"));
		if (!($account_jwt = jwt_decode($id_token, aim::$secret['aim']['client_secret']))) throw new Exception('Bad id_token', 400);
		if (!$account_jwt->valid) throw new Exception('Invalid id_token', 404);
		$payload = (array)$account_jwt->payload;
		/** Eerste aanmelder wordt eigenaar. Bijwerken userID van domain indien deze nog niet bestaat */
		if (!$client->userID) query("UPDATE item.dt SET UserID=".($client->userID = $payload[sub])." WHERE id=$client->id");
		if ($client->userID == $payload['sub']) $_GET['scope'] .=' admin:write';
		query("EXEC [api].[setAttribute] @id=$payload[sub], @name='Scope', @value='$_GET[scope]', @hostID=$client->id;");
		$scope = sqlsrv_fetch_object(query($q = "SELECT scope FROM [account].[vw] WHERE userID = $payload[sub] AND hostID = $client->id"));
		$code = array_merge(array_intersect_key($payload, array_flip(array_merge( explode(' ', $_GET['scope']),['iss','sub','nonce','auth_time','name']))),[
			'iss' => $client->name.'.aliconnect.nl', // Audience, id of host, owner of scope
			'aud' => (int)$client->id, // Audience, id of host, owner of scope
			'azp' => (int)$client->id, // From config.json
			'client_id' => (int)$client->id, // Client Identifier // application
			'scope' => trim($_GET['scope'] . (isset($scope) ? ' '.$scope->scope : '' )), // Scope Values
			'exp' => time()+60, // Expiration Time
			'iat' => time(), // Issued At
		]);
		$code = jwt_encode($code, aim::$secret['aim']['client_secret']);
		$arr = explode('#',urldecode($_GET['redirect_uri']));
		$redirect_hash = isset($arr[1])?[1]:'';
		if (isset($arr[0])) $redirect_search = ($arr = explode('?',$arr[0].'?'))[1];
		switch ($_GET['response_type']) {
			case 'token':
				$location = "$arr[0]#access_token=$code&token_type=Bearer&expires_in=600&state=$_GET[state]".($redirect_search?"&$redirect_search":"").($redirect_hash?"#$redirect_hash":"");
				break;
			case 'code':
				$location = "$arr[0]?code=$code&state=$_GET[state]".($redirect_search?"&$redirect_search":"").($redirect_hash?"#$redirect_hash":"");
				break;
		}
		die(header("Location: $location"));
	}
	public static function authenticator() {
		$html = file_get_contents('../app/authenticator/index.html');
		$data = ['get'=>$_GET,'qr'=>['text'=>'https://aliconnect.nl/?id=312312']];
		echo str_replace("</head","<script src='data:text/javascript;base64,".$dataBase64=base64_encode("data=".json_encode($data))."'></script></head",$html);
		die();
	}
}
class token {
	public function __construct() {
		//header('Access-Control-Allow-Origin: '.implode("/",array_slice(explode("/",$_SERVER["HTTP_REFERER"]),0,3)));
		header('Access-Control-Allow-Origin: *');
		header('Access-Control-Allow-Methods: GET,POST');
	}
	public static function get () {
		if($_GET['id_token']) {
			$payload = json_decode(base64_decode(explode('.',$_GET['id_token'])[1]));
			$session = sqlsrv_fetch_object(query("SELECT sub FROM auth.session WHERE id=$payload->nonce"));
			if(!$session->sub || $session->sub != $payload->sub) throw new Exception('Unauthorized', 401);
			return null;
		}
		throw new Exception('Not found', 404);
	}
	public static function post () {
    extract($_POST);
		if (!empty($grant_type)) switch ($grant_type) {
			case 'authorization_code':
  			if (!$client_id) throw new Exception('Precondition Failed', 412);
  			if (!$client_secret) throw new Exception('Precondition Failed', 412);

  			if (!$request_client = sqlsrv_fetch_object(query("EXEC [account].[get] @HostName='$client_id'"))) throw new Exception('Not Found', 404);
  			if ($request_client->client_secret != strtoupper($client_secret)) throw new Exception('Precondition Failed', 412);
  			$code = isset($code) ? $code : $refresh_token;
  			$code_jwt = jwt_decode($code, aim::$secret['aim']['client_secret']);
  			if (!$code_jwt->valid) throw new Exception('Unauthorized', 401);
  			$payload = json_decode(base64_decode(explode('.',$code)[1]));
  			if (!$client = sqlsrv_fetch_object(query("EXEC [account].[get] @HostName='$client_id'"))) throw new Exception('Not Found', 404);
  			$response = (object)[ 'expires_in' => 3600, 'token_type' => 'Bearer' ];
  			$payload = (array)$code_jwt->payload;
  			$response->access_token = jwt_encode(array_merge(array_intersect_key($payload, array_flip(['iss','sub','aud','nonce','client_id','name','email','scope'])),[
  				'iat' => time(),
  				'exp' => time() + $response->expires_in * 1000,
  			]), $client->client_secret);
				$response->id_token = jwt_encode($id_token = array_merge(array_diff_key($payload,array_flip([])),[
					'iat' => time(),
					'exp' => time() + $response->expires_in * 1000,
				]), $request_client->client_secret);
				/** if offline request then send refresh_token */
				if (isset($access_type) && $access_type == 'offline') {
					$response->refresh_token = array_merge($payload,[
						'exp' => time() + 365 * 24 * 60 * 60 * 1000,
					]);
					$response->refresh_token = jwt_encode($response->refresh_token, aim::$secret['aim']['client_secret']);
				}
        break;
		}
		return $response;
	}
}

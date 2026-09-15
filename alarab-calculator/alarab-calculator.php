<?php
/**
 * Plugin Name: حاسبة أسعار المسافرون العرب
 * Plugin URI:  https://alarabtravelers.com
 * Description: حاسبة أسعار الرحلات بثلاث فئات — نفس محرك بوت التشغيل ونفس الأسعار الحيّة. الاستعمال: [alarab_calculator] للزوار، أو [alarab_calculator mode="staff"] للفريق.
 * Version:     1.0.0
 * Author:      المسافرون العرب
 * Text Domain: alarab-calculator
 * Requires PHP: 7.4
 *
 * إضافة مستقلة تماماً: لا تلمس إضافة Seen Travel Packages ولا تعتمد عليها.
 *
 * مصدر الحقيقة للأسعار واحد — قاعدة Supabase التي يديرها بوت تليغرام.
 * هذه الإضافة تقرأ منها فقط (المفتاح العام، سياسات RLS للقراءة على جداول
 * الأسعار الخمسة) وتعرضها في الحاسبة وفي صفحة «الأسعار» بلوحة التحكم.
 * لا نسخة ثانية تُعدَّل من هنا، وإلا تباعدت النسختان وخرجت عروض خاطئة بصمت.
 */

defined( 'ABSPATH' ) || exit;

final class Alarab_Calculator {
	const OPTION  = 'alarab_calc';
	const VERSION = '1.0.0';

	/** القيم الافتراضية — كلها عامة أصلاً (المفتاح publishable مصمَّم للمتصفح). */
	const DEFAULTS = array(
		'supabase_url' => 'https://lhjfapvqvbasobrtjtdi.supabase.co',
		'supabase_key' => 'sb_publishable_fcmAehdlnIa_D6JB9iQqlw_uOpFksWN',
		'whatsapp'     => '966534436932',
		'brand'        => 'المسافرون العرب',
		'site'         => 'alarabtravelers.com',
		'bot_url'      => 'https://t.me/arabtravelbot',
		// سياسة الربح: ربح الشركة لكل يوم من أيام البرنامج بالدولار — داخلية، لا تظهر للزوار
		'margin_per_day' => '40',
	);

	public static function init(): void {
		add_shortcode( 'alarab_calculator', array( __CLASS__, 'shortcode' ) );
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'register_assets' ) );
		add_filter( 'script_loader_tag', array( __CLASS__, 'module_tag' ), 10, 3 );
		add_action( 'admin_menu', array( __CLASS__, 'admin_menu' ) );
		add_action( 'admin_init', array( __CLASS__, 'register_settings' ) );
		add_action( 'rest_api_init', array( __CLASS__, 'rest_routes' ) );
	}

	public static function options(): array {
		$saved = get_option( self::OPTION, array() );
		// الفارغ يعود إلى الافتراضي؛ الصفر قيمة صحيحة (سياسة ربح صفر = نسب الفئات)
		$saved = is_array( $saved ) ? array_filter( $saved, static function ( $v ) { return null !== $v && '' !== $v; } ) : array();
		return array_merge( self::DEFAULTS, $saved );
	}

	/* ------------------------------ الواجهة ------------------------------ */

	public static function register_assets(): void {
		$base = plugin_dir_url( __FILE__ ) . 'assets/';
		$dir  = plugin_dir_path( __FILE__ ) . 'assets/';
		// رقم الإصدار من وقت الملف: كل بناء جديد يكسر الكاش تلقائياً
		$ver = (string) max( (int) @filemtime( $dir . 'calc.js' ), (int) @filemtime( $dir . 'calc.css' ) );
		wp_register_style( 'alarab-calc', $base . 'calc.css', array(), $ver );
		wp_register_script( 'alarab-calc', $base . 'calc.js', array(), $ver, true );
	}

	/**
	 * calc.js وحدة ES تستورد pricing.js نسبياً — تحتاج type="module".
	 * المرشّح يستلم الوسم كاملاً بما فيه سكربت الإعدادات المضاف قبله، فنعدّل
	 * وسم src وحده ولا نستبدل الكل — وإلا ضاعت الإعدادات.
	 */
	public static function module_tag( string $tag, string $handle, string $src ): string {
		if ( 'alarab-calc' !== $handle ) {
			return $tag;
		}
		$tag = preg_replace( '/\\stype=([\'"])text\\/javascript\\1/', '', $tag );
		return preg_replace( '/<script(?=[^>]*\\ssrc=)/', '<script type="module"', $tag, 1 );
	}

	public static function shortcode( $atts ): string {
		$atts = shortcode_atts( array( 'mode' => 'public' ), $atts, 'alarab_calculator' );
		// وضع الفريق (تكلفة وهامش وربح) للمسجّلين بصلاحية تحرير فقط؛ غيرهم يرون الوضع العام دائماً
		$mode = ( 'staff' === $atts['mode'] && current_user_can( 'edit_posts' ) ) ? 'staff' : 'public';

		$o = self::options();
		wp_enqueue_style( 'alarab-calc' );
		wp_enqueue_script( 'alarab-calc' );
		wp_add_inline_script(
			'alarab-calc',
			'window.ALARAB_CALC = ' . wp_json_encode( array(
				'url'      => $o['supabase_url'],
				'key'      => $o['supabase_key'],
				'whatsapp' => $o['whatsapp'],
				'brand'    => $o['brand'],
				'site'     => $o['site'],
				'marginPerDay' => self::policy_cents(),
			) ) . ';',
			'before'
		);

		$form = file_get_contents( plugin_dir_path( __FILE__ ) . 'form.html' );
		if ( false === $form ) {
			return '<p>ملف الحاسبة غير موجود — أعد رفع الإضافة.</p>';
		}
		return '<div class="alarab-calc" data-mode="' . esc_attr( $mode ) . '">' . $form . '</div>';
	}

	/* ------------------------------ لوحة التحكم ------------------------------ */

	public static function admin_menu(): void {
		add_menu_page( 'حاسبة الأسعار', 'حاسبة الأسعار', 'edit_posts', 'alarab-calc', array( __CLASS__, 'render_rates_page' ), 'dashicons-calculator', 58 );
		add_submenu_page( 'alarab-calc', 'الأسعار الحالية', 'الأسعار', 'edit_posts', 'alarab-calc', array( __CLASS__, 'render_rates_page' ) );
		add_submenu_page( 'alarab-calc', 'إعدادات الحاسبة', 'الإعدادات', 'manage_options', 'alarab-calc-settings', array( __CLASS__, 'render_settings_page' ) );
	}

	public static function register_settings(): void {
		register_setting( 'alarab_calc_group', self::OPTION, array( 'sanitize_callback' => array( __CLASS__, 'sanitize' ) ) );
	}

	public static function sanitize( $in ): array {
		$in  = is_array( $in ) ? $in : array();
		$out = array();
		$out['supabase_url'] = esc_url_raw( trim( (string) ( $in['supabase_url'] ?? '' ) ) );
		$out['supabase_key'] = sanitize_text_field( (string) ( $in['supabase_key'] ?? '' ) );
		$out['whatsapp']     = preg_replace( '/\D/', '', (string) ( $in['whatsapp'] ?? '' ) );
		$out['brand']        = sanitize_text_field( (string) ( $in['brand'] ?? '' ) );
		$out['site']         = sanitize_text_field( (string) ( $in['site'] ?? '' ) );
		$out['bot_url']      = esc_url_raw( (string) ( $in['bot_url'] ?? '' ) );
		$out['margin_per_day'] = isset( $in['margin_per_day'] ) && '' !== $in['margin_per_day'] ? (string) max( 0, (float) $in['margin_per_day'] ) : '';
		delete_transient( 'alarab_calc_rates' );
		return $out;
	}

	/** يجلب جداول الأسعار الخمسة من Supabase (قراءة فقط) ويخزّنها خمس دقائق. */
	private static function fetch_rates() {
		$cached = get_transient( 'alarab_calc_rates' );
		if ( is_array( $cached ) ) {
			return $cached;
		}
		$o     = self::options();
		$q     = array(
			'destinations' => 'select=slug,name,transfer_rate,ticket_pp,guide_rate&active=eq.true&order=sort_order.asc',
			'hotels'       => 'select=destination,name,class,stars,rate_normal,rate_high,rate_triple&active=eq.true&order=rate_normal.asc',
			'cars'         => 'select=destination,kind,name,rate_day&active=eq.true&order=rate_day.asc',
			'tours'        => 'select=destination,name,price&active=eq.true&order=sort_order.asc,id.asc',
			'services'     => 'select=destination,name,price,unit&active=eq.true&order=sort_order.asc,id.asc',
		);
		$rates = array();
		foreach ( $q as $table => $query ) {
			$res = wp_remote_get(
				rtrim( $o['supabase_url'], '/' ) . '/rest/v1/' . $table . '?' . $query,
				array( 'timeout' => 10, 'headers' => array( 'apikey' => $o['supabase_key'], 'Authorization' => 'Bearer ' . $o['supabase_key'] ) )
			);
			if ( is_wp_error( $res ) ) {
				return new WP_Error( 'fetch', $res->get_error_message() );
			}
			if ( 200 !== wp_remote_retrieve_response_code( $res ) ) {
				return new WP_Error( 'fetch', $table . ': HTTP ' . wp_remote_retrieve_response_code( $res ) );
			}
			$rows = json_decode( wp_remote_retrieve_body( $res ), true );
			$rates[ $table ] = is_array( $rows ) ? $rows : array();
		}
		set_transient( 'alarab_calc_rates', $rates, 5 * MINUTE_IN_SECONDS );
		return $rates;
	}

	/* ------------------------------ سياسة الربح ------------------------------ */

	/** ربح اليوم الواحد بالسنت — الصيغة التي يفهمها محرك التسعير. */
	public static function policy_cents(): int {
		return (int) round( (float) self::options()['margin_per_day'] * 100 );
	}

	/**
	 * GET  /wp-json/alarab/v1/policy  → عام: تقرأه الحاسبة على GitHub Pages والبوت.
	 * POST /wp-json/alarab/v1/policy  → مدير فقط (Application Password): يعدّله البوت.
	 * القيمة رقم داخلي لا يُذكر في أي نص للزبون؛ كشفه هنا يخدم التطبيقات لا الزوار.
	 */
	public static function rest_routes(): void {
		register_rest_route( 'alarab/v1', '/policy', array(
			array(
				'methods'             => 'GET',
				'permission_callback' => '__return_true',
				'callback'            => static function () {
					$r = new WP_REST_Response( array( 'margin_per_day' => self::policy_cents() ) );
					$r->header( 'Cache-Control', 'no-store' );
					return $r;
				},
			),
			array(
				'methods'             => 'POST',
				'permission_callback' => static function () { return current_user_can( 'manage_options' ); },
				'args'                => array( 'margin_per_day' => array( 'required' => true, 'type' => 'integer', 'minimum' => 0 ) ),
				'callback'            => static function ( WP_REST_Request $req ) {
					$o = get_option( self::OPTION, array() );
					$o = is_array( $o ) ? $o : array();
					$o['margin_per_day'] = (string) ( ( (int) $req['margin_per_day'] ) / 100 );
					update_option( self::OPTION, $o );
					return array( 'margin_per_day' => self::policy_cents() );
				},
			),
		) );
	}

	private static function money( $cents ): string {
		return '$' . number_format( ( (int) $cents ) / 100 );
	}

	public static function render_rates_page(): void {
		if ( ! current_user_can( 'edit_posts' ) ) {
			wp_die( 'غير مسموح.' );
		}
		$o = self::options();
		if ( isset( $_GET['refresh'] ) && check_admin_referer( 'alarab_calc_refresh' ) ) {
			delete_transient( 'alarab_calc_rates' );
		}
		$rates = self::fetch_rates();
		$units = array( 'per_trip' => 'لكل نقلة', 'per_night' => 'لكل ليلة', 'per_person' => 'للشخص', 'once' => 'مرة واحدة' );
		$stars = static function ( $h ) {
			return is_numeric( $h['stars'] ) ? str_repeat( '★', (int) $h['stars'] ) : ( 'cabin' === $h['stars'] ? 'كوخ' : (string) $h['stars'] );
		};
		echo '<div class="wrap" dir="rtl"><h1>الأسعار الحالية</h1>';
		echo '<p>هذه الأسعار تُقرأ حيّة من القاعدة نفسها التي تعمل عليها الحاسبة والبوت. <strong>التعديل من البوت</strong> ';
		echo '(<a href="' . esc_url( $o['bot_url'] ) . '" target="_blank" rel="noopener">' . esc_html( $o['bot_url'] ) . '</a>) ← زر «الأسعار» — كي يبقى مصدر الأسعار واحداً.</p>';
		echo '<p><a class="button" href="' . esc_url( wp_nonce_url( admin_url( 'admin.php?page=alarab-calc&refresh=1' ), 'alarab_calc_refresh' ) ) . '">تحديث الآن</a> ';
		echo '<span class="description">تُحدَّث تلقائياً كل 5 دقائق.</span></p>';
		if ( is_wp_error( $rates ) ) {
			echo '<div class="notice notice-error"><p>تعذّر الوصول إلى القاعدة: ' . esc_html( $rates->get_error_message() ) . '</p></div></div>';
			return;
		}
		$by = static function ( array $rows, string $slug ): array {
			return array_values( array_filter( $rows, static function ( $r ) use ( $slug ) { return ( $r['destination'] ?? '' ) === $slug; } ) );
		};
		foreach ( $rates['destinations'] as $d ) {
			$slug = (string) $d['slug'];
			echo '<h2 style="margin-top:28px">' . esc_html( $d['name'] ) . '</h2>';
			echo '<p>نقلة المطار الافتراضية <b>' . esc_html( self::money( $d['transfer_rate'] ) ) . '</b> · تذكرة الدخول للشخص <b>' . esc_html( self::money( $d['ticket_pp'] ) ) . '</b> · يوم المرشد <b>' . esc_html( self::money( $d['guide_rate'] ) ) . '</b></p>';

			echo '<table class="widefat striped" style="max-width:900px"><thead><tr><th>الفندق</th><th>النجوم</th><th>الخانة</th><th>عادي / ليلة</th><th>مرتفع / ليلة</th><th>سرير ثالث</th></tr></thead><tbody>';
			foreach ( $by( $rates['hotels'], $slug ) as $h ) {
				echo '<tr><td>' . esc_html( $h['name'] ) . '</td><td>' . esc_html( $stars( $h ) ) . '</td><td>' . esc_html( $h['class'] ) . '</td><td>' . esc_html( self::money( $h['rate_normal'] ) ) . '</td><td>' . esc_html( self::money( $h['rate_high'] ) ) . '</td><td>' . esc_html( self::money( $h['rate_triple'] ) ) . '</td></tr>';
			}
			echo '</tbody></table>';

			echo '<table class="widefat striped" style="max-width:900px;margin-top:10px"><thead><tr><th>السيارة</th><th>النوع</th><th>لليوم</th></tr></thead><tbody>';
			foreach ( $by( $rates['cars'], $slug ) as $c ) {
				echo '<tr><td>' . esc_html( $c['name'] ) . '</td><td>' . esc_html( $c['kind'] ) . '</td><td>' . esc_html( self::money( $c['rate_day'] ) ) . '</td></tr>';
			}
			echo '</tbody></table>';

			echo '<table class="widefat striped" style="max-width:900px;margin-top:10px"><thead><tr><th>الجولة</th><th>للمجموعة</th></tr></thead><tbody>';
			foreach ( $by( $rates['tours'], $slug ) as $t ) {
				echo '<tr><td>' . esc_html( $t['name'] ) . '</td><td>' . esc_html( self::money( $t['price'] ) ) . '</td></tr>';
			}
			echo '</tbody></table>';

			$svcs = $by( $rates['services'], $slug );
			if ( $svcs ) {
				echo '<table class="widefat striped" style="max-width:900px;margin-top:10px"><thead><tr><th>الخدمة</th><th>السعر</th><th>الوحدة</th></tr></thead><tbody>';
				foreach ( $svcs as $s ) {
					echo '<tr><td>' . esc_html( $s['name'] ) . '</td><td>' . esc_html( self::money( $s['price'] ) ) . '</td><td>' . esc_html( $units[ $s['unit'] ] ?? $s['unit'] ) . '</td></tr>';
				}
				echo '</tbody></table>';
			}
		}
		echo '<h2 style="margin-top:28px">سياسة الربح</h2><p>ربح الشركة لليوم الواحد: <b>' . esc_html( self::money( self::policy_cents() ) ) . '</b> × (الليالي + 1). ';
		echo 'سياسة داخلية لا تظهر للزوار — تُعدَّل من <a href="' . esc_url( admin_url( 'admin.php?page=alarab-calc-settings' ) ) . '">الإعدادات</a> أو من البوت.</p>';
		echo '<h2 style="margin-top:28px">الاستعمال</h2><p>ضع <code>[alarab_calculator]</code> في أي صفحة للزوار (أسعار البيع للبالغ + زر واتساب)، أو <code>[alarab_calculator mode="staff"]</code> في صفحة للفريق (تكلفة وهامش وربح — للمسجّلين فقط).</p>';
		echo '</div>';
	}

	public static function render_settings_page(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'غير مسموح.' );
		}
		$o = self::options();
		$field = static function ( string $key, string $label, string $hint = '' ) use ( $o ) {
			echo '<tr><th scope="row"><label for="ac_' . esc_attr( $key ) . '">' . esc_html( $label ) . '</label></th><td>';
			echo '<input type="text" class="regular-text" dir="ltr" id="ac_' . esc_attr( $key ) . '" name="' . esc_attr( self::OPTION ) . '[' . esc_attr( $key ) . ']" value="' . esc_attr( $o[ $key ] ) . '">';
			if ( $hint ) {
				echo '<p class="description">' . esc_html( $hint ) . '</p>';
			}
			echo '</td></tr>';
		};
		echo '<div class="wrap" dir="rtl"><h1>إعدادات الحاسبة</h1><form method="post" action="options.php">';
		settings_fields( 'alarab_calc_group' );
		echo '<table class="form-table">';
		$field( 'supabase_url', 'رابط Supabase' );
		$field( 'supabase_key', 'المفتاح العام (publishable)', 'مفتاح قراءة فقط مصمَّم للنشر في المتصفح — ليس مفتاح الخدمة.' );
		$field( 'whatsapp', 'رقم واتساب', 'بالصيغة الدولية بلا + ولا مسافات، مثل 966534436932' );
		$field( 'brand', 'اسم الشركة' );
		$field( 'site', 'الموقع' );
		$field( 'bot_url', 'رابط بوت التشغيل' );
		$field( 'margin_per_day', 'سياسة الربح — لليوم الواحد ($)', 'ربح الشركة لكل يوم من أيام البرنامج (الليالي + 1). داخلي لا يظهر للزوار. صفر = نسب الفئات 18 · 22 · 28.' );
		echo '</table>';
		submit_button( 'حفظ' );
		echo '</form></div>';
	}
}

Alarab_Calculator::init();

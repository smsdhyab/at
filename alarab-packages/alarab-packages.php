<?php
/**
 * Plugin Name: بكجات المسافرون العرب
 * Description: نوع منشور «بكج» بحقوله الـ18، صفحة بكج منسّقة، قائمة بكجات مع فلترة، ونموذج طلب عرض سعر يصل على واتساب.
 * Version:     1.0.0
 * Author:      المسافرون العرب
 * Text Domain: aat
 *
 * لا يعتمد على أي إضافة أخرى ولا يعدّل ملفات القالب.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class AAT_Packages {

	const CPT = 'aat_package';
	const TAX = 'aat_dest';
	const VER = '1.0.0';
	const OPT = 'aat_settings';

	/** مفاتيح الحقول — مصدر واحد يقود لوحة التحرير والحفظ والعرض. */
	private static function fields() {
		return array(
			'days'         => array( 'label' => 'عدد الأيام',            'type' => 'number', 'ph' => '7' ),
			'nights'       => array( 'label' => 'عدد الليالي',           'type' => 'number', 'ph' => '6' ),
			'price_from'   => array( 'label' => 'السعر يبدأ من',         'type' => 'number', 'ph' => '1240' ),
			'currency'     => array( 'label' => 'العملة',                'type' => 'select', 'opts' => array( 'USD' => 'دولار', 'EUR' => 'يورو', 'SAR' => 'ريال سعودي', 'TRY' => 'ليرة تركية' ) ),
			'price_basis'  => array( 'label' => 'السعر لِـ',             'type' => 'text',   'ph' => 'شخصين في غرفة واحدة' ),
			'tier'         => array( 'label' => 'فئة البكج',             'type' => 'select', 'opts' => array( 'economy' => 'اقتصادي', 'premium' => 'مميز', 'vip' => 'VIP' ) ),
			'program_code' => array( 'label' => 'كود البرنامج',          'type' => 'text',   'ph' => 'north-7',
				'help' => 'البكجات التي تحمل نفس الكود تُعرض كخيارات لبعضها (اقتصادي / مميز / VIP).' ),
			'valid_until'  => array( 'label' => 'السعر صالح حتى',        'type' => 'date' ),
			'hotel_class'  => array( 'label' => 'فئة الفندق',            'type' => 'text',   'ph' => '4 نجوم مع إفطار' ),
			'transport'    => array( 'label' => 'المواصلات',             'type' => 'text',   'ph' => 'سيارة خاصة مع سائق طوال البرنامج' ),
			'min_pax'      => array( 'label' => 'الحد الأدنى للأشخاص',   'type' => 'number', 'ph' => '2' ),
			'deposit'      => array( 'label' => 'العربون',               'type' => 'text',   'ph' => '30٪ لتثبيت الحجز' ),
			'cancellation' => array( 'label' => 'سياسة الإلغاء',         'type' => 'text',   'ph' => 'إلغاء مجاني قبل 14 يوماً' ),
			'cities'       => array( 'label' => 'المدن وتوزيع الليالي',  'type' => 'lines',  'ph' => "طرابزون|3\nأوزنجول|2\nريزا|1",
				'help' => 'سطر لكل مدينة بصيغة: اسم المدينة|عدد الليالي' ),
			'itinerary'    => array( 'label' => 'البرنامج اليومي',       'type' => 'blocks', 'rows' => 14,
				'help' => 'اترك سطراً فارغاً بين كل يوم والذي يليه. أول سطر في كل يوم هو عنوانه.' ),
			'includes'     => array( 'label' => 'البكج يشمل',            'type' => 'lines',  'ph' => "الإقامة مع الإفطار\nالاستقبال والتوديع من المطار" ),
			'excludes'     => array( 'label' => 'البكج لا يشمل',         'type' => 'lines',  'ph' => "تذاكر الطيران\nالغداء والعشاء" ),
			'faq'          => array( 'label' => 'أسئلة شائعة',           'type' => 'lines',  'ph' => 'هل يوجد مرشد عربي؟|نعم، مرشد عربي طوال البرنامج.',
				'help' => 'سطر لكل سؤال بصيغة: السؤال|الجواب' ),
		);
	}

	public static function init() {
		add_action( 'init',                     array( __CLASS__, 'register' ) );
		add_action( 'add_meta_boxes',           array( __CLASS__, 'meta_box' ) );
		add_action( 'save_post_' . self::CPT,   array( __CLASS__, 'save' ), 10, 2 );
		add_filter( 'the_content',              array( __CLASS__, 'render_package' ) );
		add_action( 'wp_enqueue_scripts',       array( __CLASS__, 'styles' ) );
		add_action( 'admin_menu',               array( __CLASS__, 'settings_page' ) );
		add_action( 'admin_init',               array( __CLASS__, 'settings_register' ) );
		add_shortcode( 'aat_packages',          array( __CLASS__, 'sc_list' ) );
		add_shortcode( 'aat_quote_form',        array( __CLASS__, 'sc_form' ) );
		add_filter( 'manage_' . self::CPT . '_posts_columns',       array( __CLASS__, 'admin_cols' ) );
		add_action( 'manage_' . self::CPT . '_posts_custom_column', array( __CLASS__, 'admin_col' ), 10, 2 );
	}

	/* ------------------------------------------------------------------ */
	/*  التسجيل                                                            */
	/* ------------------------------------------------------------------ */

	public static function register() {
		register_post_type(
			self::CPT,
			array(
				'labels'       => array(
					'name'          => 'البكجات',
					'singular_name' => 'بكج',
					'add_new'       => 'أضف بكج',
					'add_new_item'  => 'أضف بكجاً جديداً',
					'edit_item'     => 'تحرير البكج',
					'search_items'  => 'ابحث في البكجات',
					'not_found'     => 'لا توجد بكجات بعد',
				),
				'public'       => true,
				'has_archive'  => 'packages',
				'menu_icon'    => 'dashicons-palmtree',
				'menu_position'=> 5,
				'rewrite'      => array( 'slug' => 'package', 'with_front' => false ),
				'supports'     => array( 'title', 'editor', 'thumbnail', 'excerpt', 'revisions' ),
				'show_in_rest' => true,
			)
		);

		register_taxonomy(
			self::TAX,
			self::CPT,
			array(
				'labels'            => array( 'name' => 'الوجهات', 'singular_name' => 'وجهة' ),
				'public'            => true,
				'hierarchical'      => true,
				'show_admin_column' => true,
				'show_in_rest'      => true,
				'rewrite'           => array( 'slug' => 'destination', 'with_front' => false ),
			)
		);
	}

	/* ------------------------------------------------------------------ */
	/*  لوحة التحرير                                                       */
	/* ------------------------------------------------------------------ */

	public static function meta_box() {
		add_meta_box( 'aat_fields', 'تفاصيل البكج', array( __CLASS__, 'meta_html' ), self::CPT, 'normal', 'high' );
	}

	public static function meta_html( $post ) {
		wp_nonce_field( 'aat_save', 'aat_nonce' );
		echo '<style>
			.aat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px;margin-top:8px}
			.aat-f label{display:block;font-weight:600;margin-bottom:4px;font-size:13px}
			.aat-f input,.aat-f select,.aat-f textarea{width:100%}
			.aat-f .aat-help{color:#666;font-size:12px;margin-top:3px;display:block}
			.aat-wide{grid-column:1/-1}
		</style>';
		echo '<div class="aat-grid">';

		foreach ( self::fields() as $key => $f ) {
			$val  = get_post_meta( $post->ID, '_aat_' . $key, true );
			$wide = in_array( $f['type'], array( 'lines', 'blocks' ), true );
			printf( '<div class="aat-f%s">', $wide ? ' aat-wide' : '' );
			printf( '<label for="aat_%1$s">%2$s</label>', esc_attr( $key ), esc_html( $f['label'] ) );

			switch ( $f['type'] ) {
				case 'select':
					printf( '<select id="aat_%1$s" name="aat_%1$s">', esc_attr( $key ) );
					foreach ( $f['opts'] as $ov => $ol ) {
						printf( '<option value="%1$s"%3$s>%2$s</option>', esc_attr( $ov ), esc_html( $ol ), selected( $val, $ov, false ) );
					}
					echo '</select>';
					break;

				case 'lines':
				case 'blocks':
					printf(
						'<textarea id="aat_%1$s" name="aat_%1$s" rows="%3$d" placeholder="%4$s">%2$s</textarea>',
						esc_attr( $key ),
						esc_textarea( $val ),
						isset( $f['rows'] ) ? (int) $f['rows'] : 5,
						esc_attr( isset( $f['ph'] ) ? $f['ph'] : '' )
					);
					break;

				default:
					printf(
						'<input type="%1$s" id="aat_%2$s" name="aat_%2$s" value="%3$s" placeholder="%4$s">',
						esc_attr( $f['type'] ),
						esc_attr( $key ),
						esc_attr( $val ),
						esc_attr( isset( $f['ph'] ) ? $f['ph'] : '' )
					);
			}

			if ( ! empty( $f['help'] ) ) {
				printf( '<span class="aat-help">%s</span>', esc_html( $f['help'] ) );
			}
			echo '</div>';
		}

		echo '</div>';
		echo '<p style="margin-top:14px;color:#666;font-size:12px">الصور: استخدم <strong>الصورة البارزة</strong> لصورة الغلاف، وبلوك «معرض» داخل المحرر لباقي الصور.</p>';
	}

	public static function save( $post_id, $post ) {
		if ( ! isset( $_POST['aat_nonce'] ) || ! wp_verify_nonce( sanitize_key( wp_unslash( $_POST['aat_nonce'] ) ), 'aat_save' ) ) {
			return;
		}
		if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
			return;
		}
		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			return;
		}

		foreach ( self::fields() as $key => $f ) {
			$name = 'aat_' . $key;
			if ( ! isset( $_POST[ $name ] ) ) {
				continue;
			}
			$raw = wp_unslash( $_POST[ $name ] );

			if ( in_array( $f['type'], array( 'lines', 'blocks' ), true ) ) {
				$clean = sanitize_textarea_field( $raw );
			} elseif ( 'number' === $f['type'] ) {
				$clean = '' === $raw ? '' : (string) floatval( $raw );
			} else {
				$clean = sanitize_text_field( $raw );
			}

			if ( '' === $clean ) {
				delete_post_meta( $post_id, '_aat_' . $key );
			} else {
				update_post_meta( $post_id, '_aat_' . $key, $clean );
			}
		}
	}

	public static function admin_cols( $cols ) {
		$new = array();
		foreach ( $cols as $k => $v ) {
			$new[ $k ] = $v;
			if ( 'title' === $k ) {
				$new['aat_price'] = 'السعر';
				$new['aat_dur']   = 'المدة';
				$new['aat_tier']  = 'الفئة';
			}
		}
		return $new;
	}

	public static function admin_col( $col, $post_id ) {
		$m = function ( $k ) use ( $post_id ) {
			return get_post_meta( $post_id, '_aat_' . $k, true );
		};
		if ( 'aat_price' === $col ) {
			echo $m( 'price_from' ) ? esc_html( self::price( $m( 'price_from' ), $m( 'currency' ) ) ) : '<span style="color:#c00">— ناقص</span>';
		} elseif ( 'aat_dur' === $col ) {
			echo $m( 'days' ) ? esc_html( $m( 'days' ) . ' أيام / ' . $m( 'nights' ) . ' ليالٍ' ) : '—';
		} elseif ( 'aat_tier' === $col ) {
			$opts = self::fields()['tier']['opts'];
			echo isset( $opts[ $m( 'tier' ) ] ) ? esc_html( $opts[ $m( 'tier' ) ] ) : '—';
		}
	}

	/* ------------------------------------------------------------------ */
	/*  أدوات                                                              */
	/* ------------------------------------------------------------------ */

	private static function opt( $key, $default = '' ) {
		$o = get_option( self::OPT, array() );
		return isset( $o[ $key ] ) && '' !== $o[ $key ] ? $o[ $key ] : $default;
	}

	private static function wa_number() {
		return preg_replace( '/\D/', '', self::opt( 'whatsapp', '905013196750' ) );
	}

	private static function wa_link( $text ) {
		return 'https://wa.me/' . self::wa_number() . '?text=' . rawurlencode( $text );
	}

	private static function price( $amount, $currency ) {
		$symbols = array( 'USD' => '$', 'EUR' => '€', 'SAR' => 'ر.س ', 'TRY' => '₺' );
		$c       = $currency ? $currency : 'USD';
		$sym     = isset( $symbols[ $c ] ) ? $symbols[ $c ] : '';
		return $sym . number_format( (float) $amount );
	}

	/** يحوّل نصاً بسطور إلى مصفوفة، مع فصل اختياري على "|". */
	private static function to_rows( $text, $split = false ) {
		$out = array();
		foreach ( preg_split( '/\r\n|\r|\n/', (string) $text ) as $line ) {
			$line = trim( $line );
			if ( '' === $line ) {
				continue;
			}
			$out[] = $split ? array_map( 'trim', array_pad( explode( '|', $line, 2 ), 2, '' ) ) : $line;
		}
		return $out;
	}

	/* ------------------------------------------------------------------ */
	/*  صفحة البكج                                                         */
	/* ------------------------------------------------------------------ */

	public static function render_package( $content ) {
		if ( ! is_singular( self::CPT ) || ! in_the_loop() || ! is_main_query() ) {
			return $content;
		}

		$id = get_the_ID();
		$m  = function ( $k ) use ( $id ) {
			return get_post_meta( $id, '_aat_' . $k, true );
		};

		$title    = get_the_title( $id );
		$price    = $m( 'price_from' ) ? self::price( $m( 'price_from' ), $m( 'currency' ) ) : '';
		$wa_text  = "السلام عليكم، مهتم بهذا البكج:\n" . $title . "\n" . get_permalink( $id ) . "\n\nأرجو إرسال عرض سعر.";
		$out      = '';

		/* --- شريط السعر --- */
		$out .= '<div class="aat-pricebar">';
		$out .= '<div class="aat-pricebar-main">';
		if ( $price ) {
			$out .= '<span class="aat-plabel">السعر يبدأ من</span>';
			$out .= '<span class="aat-price">' . esc_html( $price ) . '</span>';
			if ( $m( 'price_basis' ) ) {
				$out .= '<span class="aat-pbasis">' . esc_html( $m( 'price_basis' ) ) . '</span>';
			}
		} else {
			$out .= '<span class="aat-plabel">اطلب عرض سعر مخصص</span>';
		}
		$out .= '</div>';
		$out .= '<a class="aat-cta" href="' . esc_url( self::wa_link( $wa_text ) ) . '" target="_blank" rel="noopener">اطلب هذا البكج</a>';
		$out .= '</div>';

		/* --- الحقائق السريعة --- */
		$facts = array(
			'المدة'        => $m( 'days' ) ? $m( 'days' ) . ' أيام / ' . $m( 'nights' ) . ' ليالٍ' : '',
			'فئة الفندق'   => $m( 'hotel_class' ),
			'المواصلات'    => $m( 'transport' ),
			'الحد الأدنى'  => $m( 'min_pax' ) ? $m( 'min_pax' ) . ' أشخاص' : '',
			'العربون'      => $m( 'deposit' ),
			'الإلغاء'      => $m( 'cancellation' ),
		);
		$facts = array_filter( $facts );
		if ( $facts ) {
			$out .= '<div class="aat-facts">';
			foreach ( $facts as $k => $v ) {
				$out .= '<div class="aat-fact"><span>' . esc_html( $k ) . '</span><b>' . esc_html( $v ) . '</b></div>';
			}
			$out .= '</div>';
		}

		if ( $m( 'valid_until' ) ) {
			$out .= '<p class="aat-valid">السعر صالح حتى ' . esc_html( $m( 'valid_until' ) ) . ' ويخضع لتوفر الغرف.</p>';
		}

		/* --- خيارات الفئات (نفس كود البرنامج) --- */
		$out .= self::tier_switcher( $id, $m( 'program_code' ) );

		/* --- المدن والليالي --- */
		$cities = self::to_rows( $m( 'cities' ), true );
		if ( $cities ) {
			$out .= '<h2 class="aat-h">أين تنام كل ليلة</h2><div class="aat-cities">';
			foreach ( $cities as $c ) {
				$out .= '<div class="aat-city"><b>' . esc_html( $c[0] ) . '</b><span>' . esc_html( $c[1] ) . ' ليالٍ</span></div>';
			}
			$out .= '</div>';
		}

		/* --- محتوى المحرر (الوصف والصور) --- */
		if ( trim( wp_strip_all_tags( $content ) ) !== '' ) {
			$out .= '<div class="aat-intro">' . $content . '</div>';
		}

		/* --- البرنامج اليومي --- */
		$days = array_filter( array_map( 'trim', preg_split( '/\n\s*\n/', (string) $m( 'itinerary' ) ) ) );
		if ( $days ) {
			$out .= '<h2 class="aat-h">البرنامج اليومي</h2><ol class="aat-days">';
			foreach ( $days as $block ) {
				$lines = self::to_rows( $block );
				$head  = array_shift( $lines );
				$out  .= '<li><h3>' . esc_html( $head ) . '</h3>';
				if ( $lines ) {
					$out .= '<p>' . esc_html( implode( ' ', $lines ) ) . '</p>';
				}
				$out .= '</li>';
			}
			$out .= '</ol>';
		}

		/* --- يشمل / لا يشمل --- */
		$inc = self::to_rows( $m( 'includes' ) );
		$exc = self::to_rows( $m( 'excludes' ) );
		if ( $inc || $exc ) {
			$out .= '<div class="aat-incexc">';
			if ( $inc ) {
				$out .= '<div class="aat-inc"><h3>البكج يشمل</h3><ul>';
				foreach ( $inc as $i ) {
					$out .= '<li>' . esc_html( $i ) . '</li>';
				}
				$out .= '</ul></div>';
			}
			if ( $exc ) {
				$out .= '<div class="aat-exc"><h3>لا يشمل</h3><ul>';
				foreach ( $exc as $e ) {
					$out .= '<li>' . esc_html( $e ) . '</li>';
				}
				$out .= '</ul></div>';
			}
			$out .= '</div>';
		}

		/* --- الأسئلة الشائعة --- */
		$faq = self::to_rows( $m( 'faq' ), true );
		if ( $faq ) {
			$out .= '<h2 class="aat-h">أسئلة شائعة</h2><div class="aat-faq">';
			foreach ( $faq as $q ) {
				$out .= '<details><summary>' . esc_html( $q[0] ) . '</summary><p>' . esc_html( $q[1] ) . '</p></details>';
			}
			$out .= '</div>';
		}

		/* --- الخاتمة + شريط ثابت للجوال --- */
		$out .= '<div class="aat-closing">';
		$out .= '<p>لديك سؤال أو تريد تعديل البرنامج حسب رغبتك؟ راسلنا مباشرة، نرد خلال دقائق.</p>';
		$out .= '<a class="aat-cta" href="' . esc_url( self::wa_link( $wa_text ) ) . '" target="_blank" rel="noopener">تواصل معنا على واتساب</a>';
		$out .= '</div>';

		$out .= '<div class="aat-sticky">';
		$out .= '<span>' . ( $price ? esc_html( $price ) : 'عرض سعر مخصص' ) . '</span>';
		$out .= '<a href="' . esc_url( self::wa_link( $wa_text ) ) . '" target="_blank" rel="noopener">اطلب البكج</a>';
		$out .= '</div>';

		return '<div class="aat-package">' . $out . '</div>';
	}

	/** يعرض بكجات تحمل نفس كود البرنامج كخيارات (اقتصادي / مميز / VIP). */
	private static function tier_switcher( $id, $code ) {
		if ( ! $code ) {
			return '';
		}
		$q = new WP_Query(
			array(
				'post_type'      => self::CPT,
				'posts_per_page' => 5,
				'no_found_rows'  => true,
				'meta_query'     => array(
					array(
						'key'   => '_aat_program_code',
						'value' => $code,
					),
				),
			)
		);
		if ( $q->post_count < 2 ) {
			wp_reset_postdata();
			return '';
		}

		$labels = self::fields()['tier']['opts'];
		$html   = '<div class="aat-tiers"><span class="aat-tiers-label">اختر الفئة المناسبة</span><div class="aat-tiers-row">';
		foreach ( $q->posts as $p ) {
			$t   = get_post_meta( $p->ID, '_aat_tier', true );
			$pr  = get_post_meta( $p->ID, '_aat_price_from', true );
			$cur = get_post_meta( $p->ID, '_aat_currency', true );
			$html .= sprintf(
				'<a class="aat-tier%1$s" href="%2$s"><b>%3$s</b><span>%4$s</span></a>',
				$p->ID === $id ? ' is-current' : '',
				esc_url( get_permalink( $p->ID ) ),
				esc_html( isset( $labels[ $t ] ) ? $labels[ $t ] : get_the_title( $p->ID ) ),
				esc_html( $pr ? self::price( $pr, $cur ) : 'حسب الطلب' )
			);
		}
		wp_reset_postdata();
		return $html . '</div></div>';
	}

	/* ------------------------------------------------------------------ */
	/*  قائمة البكجات — [aat_packages]                                     */
	/* ------------------------------------------------------------------ */

	public static function sc_list( $atts ) {
		$a = shortcode_atts(
			array(
				'count'       => 24,
				'destination' => '',
				'filters'     => 'yes',
			),
			$atts,
			'aat_packages'
		);

		$args = array(
			'post_type'      => self::CPT,
			'posts_per_page' => (int) $a['count'],
			'no_found_rows'  => true,
			'orderby'        => 'date',
			'order'          => 'DESC',
		);
		if ( $a['destination'] ) {
			$args['tax_query'] = array(
				array(
					'taxonomy' => self::TAX,
					'field'    => 'slug',
					'terms'    => array_map( 'trim', explode( ',', $a['destination'] ) ),
				),
			);
		}

		$q = new WP_Query( $args );
		if ( ! $q->have_posts() ) {
			return '<p class="aat-empty">لا توجد بكجات منشورة بعد.</p>';
		}

		$out = '<div class="aat-list">';

		if ( 'yes' === $a['filters'] ) {
			$terms = get_terms( array( 'taxonomy' => self::TAX, 'hide_empty' => true ) );
			$out  .= '<div class="aat-filters">';
			$out  .= '<select class="aat-fdest" aria-label="فلترة بالوجهة"><option value="">كل الوجهات</option>';
			if ( ! is_wp_error( $terms ) ) {
				foreach ( $terms as $t ) {
					$out .= '<option value="' . esc_attr( $t->slug ) . '">' . esc_html( $t->name ) . '</option>';
				}
			}
			$out .= '</select>';
			$out .= '<select class="aat-fdur" aria-label="فلترة بالمدة"><option value="">كل المدد</option>'
				. '<option value="0-4">حتى 4 أيام</option><option value="5-7">5 إلى 7 أيام</option>'
				. '<option value="8-99">8 أيام فأكثر</option></select>';
			$out .= '<select class="aat-ftier" aria-label="فلترة بالفئة"><option value="">كل الفئات</option>'
				. '<option value="economy">اقتصادي</option><option value="premium">مميز</option>'
				. '<option value="vip">VIP</option></select>';
			$out .= '</div>';
		}

		$out .= '<div class="aat-cards">';
		foreach ( $q->posts as $p ) {
			$m     = function ( $k ) use ( $p ) {
				return get_post_meta( $p->ID, '_aat_' . $k, true );
			};
			$slugs = wp_get_post_terms( $p->ID, self::TAX, array( 'fields' => 'slugs' ) );
			$out  .= sprintf(
				'<article class="aat-card" data-dest="%s" data-days="%d" data-tier="%s">',
				esc_attr( is_wp_error( $slugs ) ? '' : implode( ' ', $slugs ) ),
				(int) $m( 'days' ),
				esc_attr( $m( 'tier' ) )
			);
			$out .= '<a href="' . esc_url( get_permalink( $p->ID ) ) . '">';
			$out .= get_the_post_thumbnail( $p->ID, 'medium_large', array( 'class' => 'aat-card-img', 'loading' => 'lazy', 'alt' => '' ) );
			$out .= '<div class="aat-card-body">';
			if ( $m( 'days' ) ) {
				$out .= '<span class="aat-card-dur">' . esc_html( $m( 'days' ) . ' أيام / ' . $m( 'nights' ) . ' ليالٍ' ) . '</span>';
			}
			$out .= '<h3>' . esc_html( get_the_title( $p->ID ) ) . '</h3>';
			if ( $m( 'hotel_class' ) ) {
				$out .= '<p class="aat-card-meta">' . esc_html( $m( 'hotel_class' ) ) . '</p>';
			}
			$out .= '<div class="aat-card-price">';
			$out .= $m( 'price_from' )
				? '<b>' . esc_html( self::price( $m( 'price_from' ), $m( 'currency' ) ) ) . '</b><span>يبدأ من</span>'
				: '<b>عرض مخصص</b>';
			$out .= '</div></div></a></article>';
		}
		wp_reset_postdata();

		$out .= '</div><p class="aat-noresult" hidden>لا توجد بكجات مطابقة — جرّب تغيير الفلترة.</p></div>';
		return $out;
	}

	/* ------------------------------------------------------------------ */
	/*  نموذج طلب عرض سعر — [aat_quote_form]                               */
	/* ------------------------------------------------------------------ */

	public static function sc_form() {
		$terms = get_terms( array( 'taxonomy' => self::TAX, 'hide_empty' => false ) );
		$dests = array();
		if ( ! is_wp_error( $terms ) ) {
			foreach ( $terms as $t ) {
				$dests[] = $t->name;
			}
		}
		if ( ! $dests ) {
			$dests = array( 'تركيا — الشمال', 'اسطنبول', 'كابادوكيا', 'أنطاليا', 'جورجيا', 'أذربيجان' );
		}

		ob_start();
		?>
		<form class="aat-form" data-wa="<?php echo esc_attr( self::wa_number() ); ?>">
			<p class="aat-form-lede">خمسة أسئلة فقط — نرسل لك عرض سعر كامل خلال 15 دقيقة.</p>

			<label>الوجهة وعدد الليالي
				<span class="aat-form-pair">
					<select name="dest" required>
						<?php foreach ( $dests as $d ) : ?>
							<option><?php echo esc_html( $d ); ?></option>
						<?php endforeach; ?>
					</select>
					<input type="number" name="nights" min="1" max="30" value="6" required aria-label="عدد الليالي">
				</span>
			</label>

			<label>عدد المسافرين
				<span class="aat-form-pair">
					<input type="number" name="adults" min="1" max="30" value="2" required aria-label="عدد الكبار" placeholder="كبار">
					<input type="number" name="kids" min="0" max="20" value="0" aria-label="عدد الأطفال" placeholder="أطفال">
				</span>
				<small>الكبار ثم الأطفال (2–11 سنة)</small>
			</label>

			<label>تاريخ السفر التقريبي
				<input type="month" name="when" required>
			</label>

			<label>فئة الفندق
				<select name="hotel">
					<option value="3 نجوم">3 نجوم</option>
					<option value="4 نجوم" selected>4 نجوم</option>
					<option value="5 نجوم">5 نجوم</option>
					<option value="كوخ أو شاليه خاص">كوخ أو شاليه خاص</option>
				</select>
			</label>

			<label>المواصلات
				<select name="car">
					<option value="سيارة خاصة مع سائق" selected>سيارة خاصة مع سائق</option>
					<option value="جولات مشتركة">جولات مشتركة</option>
					<option value="بدون مواصلات">بدون مواصلات</option>
				</select>
			</label>

			<label>ملاحظة إضافية (اختياري)
				<textarea name="note" rows="2" placeholder="مثلاً: نريد كوخاً على النهر، أو مناسبة شهر عسل"></textarea>
			</label>

			<button type="submit">أرسل الطلب على واتساب</button>
			<small class="aat-form-note">سيفتح واتساب برسالة معبّأة — راجعها ثم أرسلها.</small>
		</form>
		<?php
		return ob_get_clean();
	}

	/* ------------------------------------------------------------------ */
	/*  الأنماط والسكربت                                                   */
	/* ------------------------------------------------------------------ */

	public static function styles() {
		// لا نحمّل الأنماط إلا على الصفحات التي تحتاجها فعلاً.
		$need = is_singular( self::CPT ) || is_post_type_archive( self::CPT ) || is_tax( self::TAX );
		if ( ! $need ) {
			$post = get_post();
			$need = $post && (
				has_shortcode( $post->post_content, 'aat_packages' ) ||
				has_shortcode( $post->post_content, 'aat_quote_form' )
			);
		}
		if ( ! $need ) {
			return;
		}

		wp_register_style( 'aat', false, array(), self::VER );
		wp_enqueue_style( 'aat' );
		wp_add_inline_style( 'aat', self::css() );

		wp_register_script( 'aat', false, array(), self::VER, true );
		wp_enqueue_script( 'aat' );
		wp_add_inline_script( 'aat', self::js() );
	}

	private static function css() {
		return <<<CSS
.aat-package{--t:#0E6E6B;--c:#A8632B;--p:#2C4A3E;--ln:#D8DEDA;--bg:#F3F5F3;
  font-family:inherit;direction:rtl;text-align:right}
.aat-package .aat-h{font-size:1.4em;margin:2em 0 .6em;color:var(--p);border-bottom:2px solid var(--ln);padding-bottom:.3em}
.aat-pricebar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px;
  background:var(--p);color:#F3F5F3;padding:20px 24px;margin:0 0 20px}
.aat-plabel{display:block;font-size:.78em;opacity:.75;letter-spacing:.06em}
.aat-price{display:block;font-size:2.2em;font-weight:700;line-height:1.2;font-variant-numeric:tabular-nums}
.aat-pbasis{display:block;font-size:.8em;opacity:.8}
.aat-cta{display:inline-block;background:var(--c);color:#fff!important;text-decoration:none!important;
  padding:13px 26px;font-weight:700;font-size:1.02em;border-radius:2px;white-space:nowrap}
.aat-cta:hover{filter:brightness(1.1)}
.aat-facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1px;
  background:var(--ln);border:1px solid var(--ln);margin-bottom:14px}
.aat-fact{background:#fff;padding:12px 14px}
.aat-fact span{display:block;font-size:.76em;color:#6A776F;margin-bottom:3px}
.aat-fact b{font-size:.95em;color:var(--p);font-weight:600}
.aat-valid{font-size:.85em;color:#6A776F;margin:0 0 20px}
.aat-tiers{border:1px solid var(--ln);padding:14px;margin-bottom:22px;background:var(--bg)}
.aat-tiers-label{display:block;font-size:.8em;color:#6A776F;margin-bottom:10px}
.aat-tiers-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px}
.aat-tier{display:block;text-align:center;background:#fff;border:1px solid var(--ln);
  padding:12px 8px;text-decoration:none!important;color:inherit!important}
.aat-tier b{display:block;font-size:.95em}
.aat-tier span{display:block;font-size:1.1em;color:var(--c);font-weight:700;font-variant-numeric:tabular-nums}
.aat-tier.is-current{border-color:var(--t);border-width:2px;background:#E6F1F0}
.aat-cities{display:flex;flex-wrap:wrap;gap:10px}
.aat-city{border:1px solid var(--ln);padding:10px 16px;background:#fff}
.aat-city b{display:block;color:var(--p)}
.aat-city span{font-size:.82em;color:#6A776F}
.aat-days{list-style:none;padding:0;margin:0;counter-reset:d}
.aat-days li{counter-increment:d;border-inline-start:2px solid var(--ln);padding:0 22px 18px;position:relative}
.aat-days li:last-child{border-color:transparent}
.aat-days li::before{content:counter(d);position:absolute;inset-inline-start:-15px;top:0;
  width:28px;height:28px;border-radius:50%;background:var(--t);color:#fff;
  display:flex;align-items:center;justify-content:center;font-size:.8em;font-weight:700}
.aat-days h3{margin:0 0 .3em;font-size:1.02em;color:var(--p)}
.aat-days p{margin:0;font-size:.95em}
.aat-incexc{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin:26px 0}
.aat-inc,.aat-exc{border:1px solid var(--ln);padding:16px 18px;background:#fff}
.aat-inc{border-inline-start:3px solid var(--t)}
.aat-exc{border-inline-start:3px solid var(--c)}
.aat-inc h3,.aat-exc h3{margin:0 0 .5em;font-size:1em}
.aat-incexc ul{margin:0;padding-inline-start:18px;font-size:.94em}
.aat-faq details{border-bottom:1px solid var(--ln);padding:12px 0}
.aat-faq summary{cursor:pointer;font-weight:600;color:var(--p)}
.aat-faq p{margin:.6em 0 0;font-size:.95em}
.aat-closing{background:var(--bg);border:1px solid var(--ln);padding:22px;text-align:center;margin:30px 0}
.aat-closing p{margin:0 0 14px}
.aat-sticky{display:none}
@media(max-width:782px){
  .aat-sticky{display:flex;position:fixed;inset-inline:0;bottom:0;z-index:9998;
    align-items:center;justify-content:space-between;gap:12px;
    background:var(--p);color:#fff;padding:10px 14px;box-shadow:0 -2px 12px rgba(0,0,0,.18)}
  .aat-sticky span{font-weight:700;font-size:1.05em;font-variant-numeric:tabular-nums}
  .aat-sticky a{background:var(--c);color:#fff!important;text-decoration:none!important;
    padding:10px 18px;font-weight:700;border-radius:2px}
  .aat-package{padding-bottom:64px}
  .aat-price{font-size:1.8em}
}
/* ---- القائمة ---- */
.aat-list{--t:#0E6E6B;--c:#A8632B;--p:#2C4A3E;--ln:#D8DEDA;direction:rtl;text-align:right}
.aat-filters{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:20px}
.aat-filters select{padding:9px 12px;border:1px solid var(--ln);background:#fff;
  font-family:inherit;font-size:.92em;min-width:150px}
.aat-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:18px}
.aat-card{border:1px solid var(--ln);background:#fff;overflow:hidden}
.aat-card a{text-decoration:none!important;color:inherit!important;display:block}
.aat-card img.aat-card-img{width:100%;height:180px;object-fit:cover;display:block}
.aat-card-body{padding:14px 16px}
.aat-card-dur{font-size:.76em;color:var(--c);letter-spacing:.04em}
.aat-card h3{margin:.3em 0;font-size:1.02em;line-height:1.4;color:var(--p)}
.aat-card-meta{margin:0;font-size:.84em;color:#6A776F}
.aat-card-price{margin-top:12px;padding-top:10px;border-top:1px solid var(--ln);
  display:flex;align-items:baseline;justify-content:space-between;gap:8px}
.aat-card-price b{font-size:1.25em;color:var(--c);font-variant-numeric:tabular-nums}
.aat-card-price span{font-size:.76em;color:#6A776F}
.aat-noresult,.aat-empty{padding:26px;text-align:center;color:#6A776F;border:1px dashed var(--ln)}
/* ---- النموذج ---- */
.aat-form{--t:#0E6E6B;--c:#A8632B;--p:#2C4A3E;--ln:#D8DEDA;
  direction:rtl;text-align:right;max-width:520px;border:1px solid var(--ln);
  background:#fff;padding:22px;display:flex;flex-direction:column;gap:14px}
.aat-form-lede{margin:0;color:var(--p);font-weight:600}
.aat-form label{display:flex;flex-direction:column;gap:6px;font-size:.9em;color:#41504A;font-weight:600}
.aat-form-pair{display:flex;gap:8px}
.aat-form input,.aat-form select,.aat-form textarea{
  font-family:inherit;font-size:.95em;padding:9px 11px;border:1px solid var(--ln);
  background:#fff;color:inherit;width:100%;font-weight:400}
.aat-form small{font-weight:400;color:#6A776F;font-size:.82em}
.aat-form button{background:var(--t);color:#fff;border:0;padding:13px;font-family:inherit;
  font-size:1.02em;font-weight:700;cursor:pointer}
.aat-form button:hover{filter:brightness(1.1)}
.aat-form-note{text-align:center}
CSS;
	}

	private static function js() {
		return <<<JS
(function(){
  /* فلترة قائمة البكجات — من جهة المتصفح، بلا إعادة تحميل */
  document.querySelectorAll('.aat-list').forEach(function(list){
    var sel = list.querySelectorAll('.aat-filters select');
    if (!sel.length) return;
    var cards = list.querySelectorAll('.aat-card');
    var none  = list.querySelector('.aat-noresult');
    function apply(){
      var d = list.querySelector('.aat-fdest').value,
          u = list.querySelector('.aat-fdur').value,
          t = list.querySelector('.aat-ftier').value,
          shown = 0;
      cards.forEach(function(card){
        var days = parseInt(card.dataset.days, 10) || 0, ok = true;
        if (d && (' ' + card.dataset.dest + ' ').indexOf(' ' + d + ' ') === -1) ok = false;
        if (t && card.dataset.tier !== t) ok = false;
        if (u) { var r = u.split('-'); if (days < +r[0] || days > +r[1]) ok = false; }
        card.hidden = !ok;
        if (ok) shown++;
      });
      if (none) none.hidden = shown > 0;
    }
    sel.forEach(function(s){ s.addEventListener('change', apply); });
  });

  /* نموذج طلب عرض السعر — يبني رسالة واتساب */
  document.querySelectorAll('.aat-form').forEach(function(form){
    form.addEventListener('submit', function(e){
      e.preventDefault();
      var f = function(n){ var el = form.elements[n]; return el ? el.value.trim() : ''; };
      var lines = [
        'السلام عليكم، أرغب بعرض سعر:',
        '',
        'الوجهة: ' + f('dest'),
        'عدد الليالي: ' + f('nights'),
        'المسافرون: ' + f('adults') + ' بالغ' + (+f('kids') ? ' و' + f('kids') + ' طفل' : ''),
        'تاريخ السفر: ' + f('when'),
        'فئة الفندق: ' + f('hotel'),
        'المواصلات: ' + f('car')
      ];
      if (f('note')) lines.push('', 'ملاحظة: ' + f('note'));
      lines.push('', 'المصدر: ' + location.href);
      window.open('https://wa.me/' + form.dataset.wa + '?text=' +
        encodeURIComponent(lines.join('\\n')), '_blank', 'noopener');
    });
  });
})();
JS;
	}

	/* ------------------------------------------------------------------ */
	/*  الإعدادات                                                          */
	/* ------------------------------------------------------------------ */

	public static function settings_page() {
		add_options_page( 'إعدادات البكجات', 'إعدادات البكجات', 'manage_options', 'aat-settings', array( __CLASS__, 'settings_html' ) );
	}

	public static function settings_register() {
		register_setting(
			'aat_group',
			self::OPT,
			array(
				'sanitize_callback' => function ( $in ) {
					return array( 'whatsapp' => isset( $in['whatsapp'] ) ? preg_replace( '/\D/', '', $in['whatsapp'] ) : '' );
				},
			)
		);
	}

	public static function settings_html() {
		?>
		<div class="wrap">
			<h1>إعدادات البكجات</h1>
			<form method="post" action="options.php">
				<?php settings_fields( 'aat_group' ); ?>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="aat_wa">رقم الواتساب</label></th>
						<td>
							<input type="text" id="aat_wa" class="regular-text" dir="ltr"
								name="<?php echo esc_attr( self::OPT ); ?>[whatsapp]"
								value="<?php echo esc_attr( self::opt( 'whatsapp', '905013196750' ) ); ?>">
							<p class="description">بالصيغة الدولية بدون + وبدون مسافات، مثال: 905013196750</p>
						</td>
					</tr>
				</table>
				<?php submit_button(); ?>
			</form>

			<h2>الأكواد المختصرة</h2>
			<table class="widefat striped" style="max-width:760px">
				<tbody>
					<tr><td><code>[aat_packages]</code></td><td>قائمة كل البكجات مع الفلترة</td></tr>
					<tr><td><code>[aat_packages count="6" filters="no"]</code></td><td>أحدث 6 بكجات بدون فلترة — للصفحة الرئيسية</td></tr>
					<tr><td><code>[aat_packages destination="trabzon"]</code></td><td>بكجات وجهة محددة — لصفحة الوجهة</td></tr>
					<tr><td><code>[aat_quote_form]</code></td><td>نموذج «اطلب عرض سعر» (الأسئلة الخمسة)</td></tr>
				</tbody>
			</table>
		</div>
		<?php
	}
}

AAT_Packages::init();

/* تحديث روابط ووردبريس عند التفعيل والإلغاء حتى تعمل صفحات البكجات فوراً. */
register_activation_hook(
	__FILE__,
	function () {
		AAT_Packages::register();
		flush_rewrite_rules();
	}
);
register_deactivation_hook( __FILE__, 'flush_rewrite_rules' );

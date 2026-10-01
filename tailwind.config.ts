import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			// Tailwind's built-in line-clamp only covers 1-6. NoteCard relies on
			// larger values to size card previews, and select.tsx uses -1; without
			// these the classes emit no CSS at all and text never truncates.
			lineClamp: {
				1: '1',
				2: '2',
				3: '3',
				4: '4',
				5: '5',
				6: '6',
				8: '8',
				9: '9',
				15: '15',
				16: '16'
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				/*
				 * The shared hover surface. Exposed as `hover` so call sites read
				 * `hover:bg-hover` — the token describes the intent, and its alpha is
				 * tuned per theme inside index.css. Never hardcode the veil here.
				 */
				hover: 'hsl(var(--hover))',
				/*
				 * Search-match highlight, so both themes can be tuned together instead of the
				 * two files that render highlights each hardcoding their own yellow.
				 */
				highlight: 'hsl(var(--highlight))',
				/* The ON colour for switches. See index.css for why it is blue. */
				switch: {
					on: 'hsl(var(--switch-on))'
				},
				/*
				 * Scrim for the floating bottom navigation. Separate from the surface tokens
				 * because that capsule stays dark in both themes; the normal tokens invert.
				 */
				nav: {
					DEFAULT: 'hsl(var(--nav-bg))',
					border: 'hsl(var(--nav-border))',
					active: 'hsl(var(--nav-active))',
					icon: 'hsl(var(--nav-icon))',
					'icon-hover': 'hsl(var(--nav-icon-hover))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				},
				'slide-up': {
					from: {
						opacity: '0',
						transform: 'translateY(8px)'
					},
					to: {
						opacity: '1',
						transform: 'translateY(0)'
					}
				},
				'slide-down': {
					from: {
						opacity: '1',
						transform: 'translateY(0)'
					},
					to: {
						opacity: '0',
						transform: 'translateY(8px)'
					}
				},
			'shake': {
				'0%, 100%': {
					transform: 'translateX(0)'
				},
				'10%, 30%, 50%, 70%, 90%': {
					transform: 'translateX(-4px)'
				},
				'20%, 40%, 60%, 80%': {
					transform: 'translateX(4px)'
				}
			},
			'hero-expand': {
				'0%': {
					transform: 'scale(0.85)',
					opacity: '0',
					borderRadius: '16px'
				},
				'100%': {
					transform: 'scale(1)',
					opacity: '1',
					borderRadius: '0'
				}
			},
			'hero-collapse': {
				'0%': {
					transform: 'scale(1)',
					opacity: '1',
					borderRadius: '0'
				},
				'100%': {
					transform: 'scale(0.85)',
					opacity: '0',
					borderRadius: '16px'
				}
			},
			'search-expand': {
				'0%': {
					width: '0',
					opacity: '0',
					transform: 'scaleX(0)'
				},
				'70%': {
					width: '100%',
					opacity: '1',
					transform: 'scaleX(1.03)'
				},
				'100%': {
					width: '100%',
					opacity: '1',
					transform: 'scaleX(1)'
				}
			}
		},
		animation: {
			'accordion-down': 'accordion-down 0.2s ease-out',
			'accordion-up': 'accordion-up 0.2s ease-out',
			'slide-up': 'slide-up 0.15s ease-out',
			'slide-down': 'slide-down 0.15s ease-out forwards',
			'shake': 'shake 0.5s ease-in-out',
			'hero-expand': 'hero-expand 0.25s cubic-bezier(0.32, 0.72, 0, 1) forwards',
			'hero-collapse': 'hero-collapse 0.2s cubic-bezier(0.32, 0, 0.67, 0) forwards',
			'search-expand': 'search-expand 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
		}
		}
	},
	plugins: [tailwindcssAnimate],
} satisfies Config;

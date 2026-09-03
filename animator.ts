import z from "zod";

export const END_OF_STREAM_POLICIES = [
	"CUT_STRICT_END",
	"CUT_AFTER_15min",
	"CUT_AFTER_5min",
	"NO_FORCE_CUT",
];

export const STREAM_MODES = ["RTMP", "SRT"];

export const SRT_ENCRYPTION_LEVELS = {
	None: 0,
	"AES-128": 16,
	"AES-192": 24,
	"AES-256": 32,
};

export const DEFAULT_SECRET_SIZE = 56;

// Represent an live streamer / animator (ie. someone who can start live stream)
export const Animator = z.object({
	username: z.string().regex(/^[A-Za-z0-9_-]+$/), // this is the ID in database
	allowed_modes: z.enum(STREAM_MODES).array().default(["SRT"]),
	disabled_account: z.boolean().default(false),
	allow_stream_outside_schedule: z.boolean().default(false),
	end_of_stream_policy: z
		.enum(END_OF_STREAM_POLICIES)
		.default("CUT_AFTER_5min"),
	srt_secret: z
		.string()
		.min(32)
		.max(79)
		.regex(/^[A-Za-z0-9_-]+$/)
		.meta({ sensitive: true }),
	rtmp_secret: z
		.string()
		.min(32)
		.max(79)
		.regex(/^[A-Za-z0-9_-]+$/)
		.meta({ sensitive: true }),
	secret_last_rotated: z.iso.datetime(),
	last_streamed_at: z.iso.datetime().optional(),

	srt_encryption_mode: z.enum(Object.keys(SRT_ENCRYPTION_LEVELS)),
	stream_title: z.string().optional(),

	created_at: z.iso.datetime().optional(),
	updated_at: z.iso.datetime().optional(),
	created_by: z.string().optional(),
	updated_by: z.string().optional(),
});

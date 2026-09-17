CREATE TYPE "public"."initiative_category" AS ENUM('Environment', 'Education', 'Healthcare', 'Blood Donation', 'Animal Welfare', 'Disaster Relief', 'Community Service', 'Awareness Campaigns', 'Public Consultations');--> statement-breakpoint
CREATE TYPE "public"."initiative_status" AS ENUM('upcoming', 'ongoing', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('pending', 'reviewed', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."reportable_type" AS ENUM('post', 'comment', 'initiative');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin', 'moderator');--> statement-breakpoint
CREATE TABLE "bookmarks" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"initiativeId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"postId" integer NOT NULL,
	"userId" integer NOT NULL,
	"content" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "initiatives" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text NOT NULL,
	"category" "initiative_category" NOT NULL,
	"status" "initiative_status" DEFAULT 'upcoming' NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"address" varchar(500),
	"city" varchar(255),
	"state" varchar(255),
	"latitude" real,
	"longitude" real,
	"startDate" timestamp NOT NULL,
	"endDate" timestamp,
	"organizationId" integer,
	"imageUrl" text,
	"registrationLink" varchar(500),
	"contactInfo" text,
	"participantCount" integer DEFAULT 0 NOT NULL,
	"bookmarkCount" integer DEFAULT 0 NOT NULL,
	"createdBy" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"logoUrl" text,
	"contactEmail" varchar(320),
	"contactPhone" varchar(64),
	"website" varchar(500),
	"verified" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_likes" (
	"id" serial PRIMARY KEY NOT NULL,
	"postId" integer NOT NULL,
	"userId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"content" text NOT NULL,
	"mediaUrl" text,
	"initiativeId" integer,
	"likeCount" integer DEFAULT 0 NOT NULL,
	"commentCount" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"reportableType" "reportable_type" NOT NULL,
	"reportableId" integer NOT NULL,
	"reason" text NOT NULL,
	"reporterId" integer NOT NULL,
	"status" "report_status" DEFAULT 'pending' NOT NULL,
	"resolvedBy" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"bio" text,
	"location" varchar(255),
	"avatarUrl" text,
	"contributionScore" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_profiles_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_initiativeId_initiatives_id_fk" FOREIGN KEY ("initiativeId") REFERENCES "public"."initiatives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_postId_posts_id_fk" FOREIGN KEY ("postId") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiatives" ADD CONSTRAINT "initiatives_organizationId_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiatives" ADD CONSTRAINT "initiatives_createdBy_users_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_postId_posts_id_fk" FOREIGN KEY ("postId") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_initiativeId_initiatives_id_fk" FOREIGN KEY ("initiativeId") REFERENCES "public"."initiatives"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporterId_users_id_fk" FOREIGN KEY ("reporterId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolvedBy_users_id_fk" FOREIGN KEY ("resolvedBy") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bookmarks_user_initiative_unique" ON "bookmarks" USING btree ("userId","initiativeId");--> statement-breakpoint
CREATE UNIQUE INDEX "post_likes_user_post_unique" ON "post_likes" USING btree ("userId","postId");
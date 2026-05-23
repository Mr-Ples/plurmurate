import { redirect } from "react-router";
import { getCurrentUser } from "~/lib/auth/session";
import { createNomination } from "~/services/nomination-service";
import { storeNominationImage } from "~/services/media-service";
import { voteOnNomination } from "~/services/vote-service";

export async function loader() {
  return redirect("/#new-post");
}

export async function action({ request, context }: any) {
  const user = await getCurrentUser(request, context);
  if (!user) throw redirect("/login");
  const formData = await request.formData();
  if (formData.get("_intent") === "vote") {
    await voteOnNomination(context, user, formData);
    return redirect("/");
  }
  const nomination = await createNomination(context, user, formData);
  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    await storeNominationImage(context, user, nomination.id, image, "nomination_image", new URL(request.url).origin);
  }
  return redirect(`/nominations/${nomination.id}`);
}

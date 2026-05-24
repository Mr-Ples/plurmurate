import { redirect } from "react-router";
import { getCurrentUser } from "~/lib/auth/session";
import { createNomination } from "~/services/nomination-service";
import { storeNominationImage } from "~/services/media-service";
import { evaluateNomination } from "~/services/approval-service";
import { voteOnNomination } from "~/services/vote-service";

export async function loader() {
  return redirect("/#new-post");
}

export async function action({ request, context }: any) {
  const user = await getCurrentUser(request, context);
  if (!user) throw redirect("/login");
  const formData = await request.formData();
  const appOrigin = new URL(request.url).origin;
  if (formData.get("_intent") === "vote") {
    await voteOnNomination(context, user, formData, appOrigin);
    return redirect("/");
  }
  const nomination = await createNomination(context, user, formData, appOrigin);
  const images = formData.getAll("image").filter((image: unknown): image is File => image instanceof File && image.size > 0).slice(0, 4);
  for (const image of images) {
    await storeNominationImage(context, user, nomination.id, image, "nomination_image", appOrigin);
  }
  await evaluateNomination(context, nomination, appOrigin);
  return redirect("/");
}

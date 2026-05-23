import { redirect } from "react-router";

export async function loader() {
  return redirect("/settings");
}

export async function action() {
  return redirect("/settings");
}

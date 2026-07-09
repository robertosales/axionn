import { useLocation } from "react-router-dom";
import { hasManagedApplicationChrome } from "@/lib/layoutRoutes";
import {
  OrganizationSwitcherImpl,
  type OrganizationSwitcherProps,
} from "@/components/OrganizationSwitcherImpl";

export function OrganizationSwitcher({
  variant = "floating",
}: OrganizationSwitcherProps) {
  const location = useLocation();

  if (variant === "floating" && hasManagedApplicationChrome(location.pathname)) {
    return null;
  }

  return <OrganizationSwitcherImpl variant={variant} />;
}

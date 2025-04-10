export const setTag = async () => {
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': `token ${pulumiAccessToken}`
  };

  // Delete the tag if it exists. Don't worry if it doesn't.
  const deleteTagUrl = `https://api.pulumi.com/api/stacks/${stackFqdn}/tags/${tagName}`;
  const deleteResponse = await fetch(deleteTagUrl, {
    method: "DELETE",
    headers,
  })

  // Set the tag.
  const setTagUrl = `https://api.pulumi.com/api/stacks/${stackFqdn}/tags`;
  const setResponse = await fetch(setTagUrl, {
      method: "POST",
      body: `{"name":"${tagName}","value":"${tagValue}"}`,
      headers,
  })
  if (!setResponse.ok) {
      let errMessage = "";
      try {
          errMessage = await setResponse.text();
      } catch { }
      throw new Error(`failed to set ${tagName} tag for stack, ${org}/${project}/${stack}: ${errMessage}`);
  } 
}
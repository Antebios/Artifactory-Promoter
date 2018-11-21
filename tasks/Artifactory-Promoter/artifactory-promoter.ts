import tl = require('azure-pipelines-task-lib/task');
//import * as tl from 'azure-pipelines-task-lib';
//import rc = require('node-rest-client').Client;
//vimport * as utils from '../../artifactory-tasks-utils'

const stripTrailingSlash = (str) => {
  return str.endsWith('/') ?
      str.slice(0, -1) :
      str;
};

let buildDefinition = tl.getVariable('Build.DefinitionName');
let buildNumber = tl.getVariable('Build.BuildNumber');

// Get input parameters
let artifactoryService = tl.getInput("artifactoryService", false);
let artifactoryUrl = tl.getEndpointUrl(artifactoryService, false);
    artifactoryUrl = stripTrailingSlash(artifactoryUrl);
let artifactoryUser = tl.getEndpointAuthorizationParameter(artifactoryService, "username", true);
let artifactoryPassword = tl.getEndpointAuthorizationParameter(artifactoryService, "password", true);

let sourceRepo = tl.getInput("sourceRepo", true);
let targetRepo = tl.getInput("targetRepo", true);

let Status = tl.getInput("status", true);
let Comment = tl.getInput("comment", true);
let CopyArtifacts = tl.getInput("copy", true);
let IncludeArtifacts = tl.getInput("artifacts", true);
let IsDryRun = tl.getInput("dryRun", true);
let IsFailFast = tl.getInput("failFast", true);

//$artifactoryUrl = "http://motdbsdev0134.motivadev.dev:8081/artifactory"
//$artifactoryEndpointName = "$($artifactoryUrl)/"
//$buildName = "RA-Common"
//$BuildNumberInput = "RA-Common-1.0.0"
//$artifactoryUser = "mottfs-0276-s"
//#$password = "AP5EeHVfvhBbHymL3F1mTkVi9TU" # richard-nunez
//#$artifactoryPwd = "AP3pz2NpRQgSYvFpTdfsozxCsBe" # admin
//$artifactoryPwd = "AP395oP4d1FxzRAxvGQgPYqHHj7" # mottfs-0276-s
//$repository_source = "biztalk-msi-build-local"
//$repository_target = "biztalk-msi-dev-local"

//$IsDryRun = $false
//$CopyArtifacts = $true
//$IncludeArtifacts = $false
//$IsFailFast = $true



// Write-Host "Converting Login and Password to authenticatino object..."
let options_auth = { user: artifactoryUser, password: artifactoryPassword };

let Client = require('node-rest-client').Client;
let client = new Client(options_auth);


// Write-Host 'Entering JFrog Artifactory Copy task'
console.log("Entering JFrog Artifactory Copy task");

// # Get build artifacts
let buildArtifactsUrl = artifactoryUrl + "/api/search/buildArtifacts";
let bodyBuildArtifacts = {
  buildName : buildDefinition,
  buildNumber :  buildNumber,
  repos : [
    sourceRepo
  ]
};
console.log("################## Json body to find build artifacts for build:");
console.log(bodyBuildArtifacts);

let args = {
  data: { bodyBuildArtifacts },
  headers: { "Content-Type": "application/json" }
};

let BuildArtifactsResults = client.post(buildArtifactsUrl, args, function (data, response) {
  // parsed response body as js object
  console.log(data);
  // raw response
  console.log(response);
});
// Now loop through each build artifact
for (let _artifact of BuildArtifactsResults.results) {
  console.log("");
  let artifactObj = _artifact.downloadUri;
  let artifactoryEndpointName = artifactoryUrl + "/";
  let PathToArtifact = artifactObj.replace(artifactoryEndpointName,'');
  console.log("Path to Source Artifact: " + PathToArtifact);

  let PathToArtifactArray = PathToArtifact.split('/');
  PathToArtifactArray[0] = targetRepo;
  let NewTargetpath = PathToArtifactArray.join("/");
  console.log("Path to Target Artifact: " + NewTargetpath);

  // Now copy the individual artifact
  let MethodToPromote: string = "move";
  if (CopyArtifacts == "true") { MethodToPromote = "copy"; }
  if (CopyArtifacts == "false") { MethodToPromote = "move"; }

  let DryRunFlag: string = "0";
  if (IsDryRun == "true") { DryRunFlag = "1"; }
  if (IsDryRun == "false") { DryRunFlag = "0"; }
  let copyArtifactUrl = `${artifactoryUrl}/api/${MethodToPromote}/${PathToArtifact}?to=/${NewTargetpath}&dry=${DryRunFlag}`;

  let copyResult = client.post(copyArtifactUrl, function (data, response) {
    // parsed response body as js object
    console.log(data);
    // raw response
    console.log(response);
  });
  
  copyResult.on('error', function (err) {
    console.log('something went wrong on the request: ', err);
  });;
  
  //   If ($copyResult.messages.level -eq "ERROR") {
  //     Write-Host "#### Error message:"
  //     Write-Error $copyResult.messages.message
  //   }
  //   else {
  //     if ($copyResult.messages.message -like "*completed successfully*" ) {
  //       Write-Host "#### Completed successfully message:"
  //       Write-Host $copyResult.messages.message
  //     }
  //     else {
  //       Write-Host "#### Other message:"
  //       Write-Error $copyResult.messages.message
  //     }
  //   }

  let bodyPromote = {
    status : buildDefinition,
    dryRun :  buildNumber,
    repos : [
      sourceRepo
    ]
  };
  //   # Now create a promotion entry - manually
  //   $bodyPromote = @{}
  //   $bodyPromote.status = "Deployed"
  //   $bodyPromote.dryRun = $IsDryRun
  //   $bodyPromote.sourceRepo = "$repository_source"
  //   $bodyPromote.targetRepo = "$repository_target"
  //   $bodyPromote.copy = $CopyArtifacts
  //   $bodyPromote.artifacts = $IncludeArtifacts
  //   $bodyPromote.dependencies = $false
  //   $bodyPromote.failFast = $IsFailFast
  //   $jsonBody = ConvertTo-JSON $bodyPromote
  //   Write-Host ""
  //   Write-Host "#### Json body for creating deployment entry:"
  //   Write-Host $jsonBody
  //   $promotionUrl = [string]::Format("{0}/api/build/promote/{1}/{2}", $artifactoryUrl, $buildName, $BuildNumberInput)
  //   Write-Host "Promotion URL: $promotionUrl"
  //   try {
  //     $promoteResult = ""
  //     $promoteResult = Invoke-RestMethod -Uri $promotionUrl -Method Post -Headers $Headers -ContentType "application/json" -Body $jsonBody -ErrorVariable RespErr
      
  //     #catch {$err=$_.Exception}
  //     #$err | Get-Member -MemberType Property
  //     #Write-Host "RespErr = $($RespErr)"
    
  //     If ($promoteResult.messages.level -eq "ERROR") {
  //       # Is NOT Successful
  //       Write-Error $promoteResult.messages.message
  //     }
  //     else {
  //       # Is Successful
  //       If (-Not ([string]::IsNullOrEmpty($promoteResult.messages))) {
  //         Write-Info $promoteResult.messages.message
  //       }
  //       Write-Host "Promotion was Successful!"
  //     }
  //   }
  //   catch [System.Net.WebException] {   
  //     $respStream = $_.Exception.Response.GetResponseStream()
  //     $reader = New-Object System.IO.StreamReader($respStream)
  //     $respBody = $reader.ReadToEnd() | ConvertFrom-Json
  //     #$respBody;
  //     If ($IsFailFast -eq $false) {
  //       If (-Not ([string]::IsNullOrEmpty($respBody.errors.message))) {
  //         Write-Error $respBody.errors.message
  //       }
  //     }
  //   }
  //   ## end of Try

}







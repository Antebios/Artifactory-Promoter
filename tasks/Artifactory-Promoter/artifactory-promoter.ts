import tl = require('azure-pipelines-task-lib/task');

const stripTrailingSlash = (str) => {
  return str.endsWith('/') ?
      str.slice(0, -1) :
      str;
};

async function run() {

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
  let PromoteComment = tl.getInput("comment", true);
  let CopyArtifacts = tl.getInput("copy", true);
  let IncludeArtifacts = tl.getInput("artifacts", true);
  // let IncludeDependencies = tl.getInput("includeDependencies", true);
  let IsDryRun = tl.getInput("dryRun", true);
  let IsFailFast = tl.getInput("failFast", true);


  // Get environmental variables set at the command prompt for testing
  // let artifactoryUrl = "http://10.58.20.20:8081/artifactory/";
  // artifactoryUrl = stripTrailingSlash(artifactoryUrl);
  // let artifactoryUser = "mottfs-0276-s";
  // let artifactoryPassword = "M2T97drl";
  // let sourceRepo = tl.getVariable("sourceRepo");
  // let targetRepo = tl.getVariable("targetRepo");
  // let Status = tl.getVariable("status");
  // let PromoteComment = tl.getVariable("comment");
  // let CopyArtifacts = tl.getVariable("copy");
  // let IncludeArtifacts = tl.getVariable("artifacts");
  // // let IncludeDependencies = tl.getVariable("includeDependencies");
  // let IsDryRun = tl.getVariable("dryRun");
  // let IsFailFast = tl.getVariable("failFast");



  // Write-Host "Converting Login and Password to authenticatino object..."
  let options_auth = { user: artifactoryUser, password: artifactoryPassword };

  let Client = require('node-rest-client').Client;
  let client = new Client(options_auth);


  // Write-Host 'Entering JFrog Artifactory Copy task'
  console.log("Entering Artifactory Promotion task");

  // # Get build artifacts
  let buildArtifactsUrl = artifactoryUrl + "/api/search/buildArtifacts";
  let args = {
    data: { "buildName" :buildDefinition,
            "buildNumber" :  buildNumber,
            "repos" : [ sourceRepo ] },
    headers: { "Content-Type": "application/json", "Accept" : "application/json" }
  };
  console.log("################## Json body to find build artifacts for build:");
  console.log(args);

  console.log("About to get artifacts with url: " + buildArtifactsUrl);
  // let BuildArtifactsResults = 
  client.post(buildArtifactsUrl, args, function (data, response) {
    if (data.hasOwnProperty("errors")) {
      console.log("The search for build artifacts results in a Failure with the following results:");
      console.log(data);
      let errorMessage = "The search for build artifacts results in a Failure with the following results: " + data.errors[0].message;
      tl.setResult(tl.TaskResult.Failed, errorMessage);
      return;
    } else {
      console.log("The search for build artifacts results was a success.");
      console.log(data);

      //Now loop through each build artifact
      for (let _artifact of data.results) {
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
        if (IncludeArtifacts == "false") { 
          DryRunFlag = "1";
          console.log("Please be aware that NO artifacts will be copied/moved since Promote Artifacts checkbox is unchecked.");
        }
        let copyArtifactUrl = `${artifactoryUrl}/api/${MethodToPromote}/${PathToArtifact}?to=/${NewTargetpath}&dry=${DryRunFlag}`;

        console.log("Promote Url: " + copyArtifactUrl)
        let args = {
          headers: { "Accept" : "application/json" }
        };
        let copyResult = client.post(copyArtifactUrl, args, function (data, response) {
          // parsed response body as js object
          let returnData = JSON.parse(data.toString('utf8'));

          if (returnData.hasOwnProperty("errors")) {
            console.log("The movement for build artifacts resulted in a Failure with the following results:");
            console.log(returnData);
            let errorMessage = "The movement for build artifacts resulted in a Failure with the following results: " + returnData.errors[0].message;
            tl.setResult(tl.TaskResult.Failed, errorMessage);
            return;
          } else {
            if (returnData.messages[0].level == 'ERROR') {
              console.log("The movement for build artifacts resulted in a Failure with the following results:");
              console.log(returnData);
              let errorMessage = "The movement for build artifacts resulted in a Failure with the following results: " + returnData.messages[0].message;
              tl.setResult(tl.TaskResult.Failed, errorMessage);
              return;
            } else {
              console.log("The movement for build artifacts results was a success.");

              // # Now create a promotion entry - manually
              let args = {
                data: { "status" : Status,
                        "comment" : PromoteComment, 
                        "dryRun" : IsDryRun,
                        "sourceRepo" : sourceRepo,
                        "targetRepo" : targetRepo,
                        "copy" : CopyArtifacts,
                        "artifacts" : false,
                        "dependencies" : false,
                        "failFast" : IsFailFast},
                headers: { "Content-Type": "application/json", "Accept" : "application/json" }
              };
              
              console.log("");
              console.log("################## Json body for creating deployment entry:");
              console.log(args);
              console.log("Please note: artifacts and dependencies will always be FALSE since this step is only making a promotion entry.");
              let promotionUrl = `${artifactoryUrl}/api/build/promote/${buildDefinition}/${buildNumber}`;
              console.log("Promotion URL: " + promotionUrl);
              let promoteResult = client.post(promotionUrl, args, function (data, response) {
                if (data.hasOwnProperty("errors")) {
                  console.log("The promotion function failed with the following results:");
                  console.log(data);
                  let errorMessage = "The promotion function failed with the following results: " + data.errors[0].message;
                  tl.setResult(tl.TaskResult.Failed, errorMessage);
                  return;
                } else {
                  //let returnData = JSON.parse(data.toString('utf8'));
                  if(data.messages.length > 0) {
                    if (returnData.messages[0].level == 'ERROR') {
                      console.log("The promotion function for build artifacts resulted in a Failure with the following results:");
                      let errorMessage = "The promotion function for build artifacts resulted in a Failure with the following results: " + returnData.messages[0].message;
                      tl.setResult(tl.TaskResult.Failed, errorMessage);
                      return;
                    } else {
                      console.log("The promotion function for build artifacts results was a success.");
                      tl.setResult(tl.TaskResult.Succeeded, "The promotion function for build artifacts results was a success.");
                      return;
                    }
                    console.log(returnData);
                  } else {
                    console.log("The promotion function for build artifacts results was a success.");
                    tl.setResult(tl.TaskResult.Succeeded, "The promotion function for build artifacts results was a success.");
                    return;
                  }
                }
              });
              promoteResult.on('error', function (err) {
                console.log('Something went wrong with the Promotion request: ', err);
              });
            }
          }
        });
        copyResult.on('error', function (err) {
          console.log('Something went wrong with the Copy/Move request: ', err);
        });
      }
    }
  });
}

run();
